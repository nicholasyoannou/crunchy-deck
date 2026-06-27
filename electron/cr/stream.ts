import { app } from 'electron'
import path from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { crFetch, CR } from './client.js'
import { accessToken, accountId } from './auth.js'

// Sync watch progress back to Crunchyroll (seconds), like the official apps — called periodically
// while watching and on exit, so Continue Watching / resume points stay in sync across devices.
export async function setPlayhead(contentId: string, playhead: number) {
  if (!contentId || !(playhead >= 0)) return
  try {
    const token = await accessToken()
    await crFetch(`${CR.API}/content/v2/${accountId()}/playheads`, {
      bearer: token,
      json: { content_id: contentId, playhead: Math.floor(playhead) }
    })
  } catch {
    /* best-effort; progress sync must never break playback */
  }
}

// CR caps concurrent streams. A hard-killed player never runs its release (onDestroy), leaking the
// slot until it idle-expires (~minutes) and eventually 4035s the next license. We track our own play
// tokens on disk and release any leftovers before opening a new session, so leaks can't pile up.
const tokensFile = () => path.join(app.getPath('userData'), 'active-tokens.json')

function readTokens(): { contentId: string; token: string }[] {
  try {
    const list = JSON.parse(readFileSync(tokensFile(), 'utf8'))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
function writeTokens(list: { contentId: string; token: string }[]) {
  try {
    writeFileSync(tokensFile(), JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

async function deleteToken(contentId: string, token: string) {
  const at = await accessToken()
  try {
    await crFetch(`${CR.PLAY}/v1/token/${contentId}/${token}`, { method: 'DELETE', bearer: at })
    console.log('[play] DELETE ok', String(token).slice(0, 16))
  } catch (e: any) {
    console.log('[play] DELETE FAIL', String(token).slice(0, 16), 'status', e?.status, String(e?.message).slice(0, 80))
    throw e
  }
}

// Release any play tokens left over from a previous hard-kill, before opening a new session.
export async function releaseLeakedStreams(): Promise<number> {
  const list = readTokens()
  if (!list.length) return 0
  let cleared = 0
  for (const { contentId, token } of list) {
    try {
      await deleteToken(contentId, token)
      cleared++
    } catch {
      /* token may already have expired */
    }
  }
  writeTokens([])
  console.log('[streams] released', cleared, 'leaked of', list.length)
  return cleared
}

// Resolve an episode's playable stream (DASH manifest + Widevine DRM token) from the TV play service.
// The renderer needs the access token too, for the Bearer on manifest/segments/license.
export interface AudioVersion {
  audio_locale: string
  guid: string
  original?: boolean
}
export interface StreamMeta {
  title: string
  seriesTitle: string
  seasonNumber: number | null
  episodeNumber: number | null
  durationMs: number | null
  maturityRating: string | null // e.g. "14"
  maturitySystem: string | null // e.g. "cr-tv"
  descriptors: string[]
}

export async function resolveStream(episodeId: string) {
  const released = await releaseLeakedStreams() // free any slot a prior hard-kill leaked before we open a new one
  const token = await accessToken()
  // Play (DRM token + manifest + audio versions + burned-in subtitle variants) and the content object
  // (title + age rating + episode numbering for the player chrome) in parallel.
  const [play, obj] = await Promise.all([
    crFetch<any>(`${CR.PLAY}/v1/${episodeId}/tv/samsung/play`, { bearer: token }),
    crFetch<any>(`${CR.API}/content/v2/cms/objects/${episodeId}?locale=en-US`, { bearer: token }).catch(() => null)
  ])
  console.log('[play] resolve', episodeId, '| token', String(play.token).slice(0, 16), '| leaksReleased', released)
  writeTokens([...readTokens(), { contentId: episodeId, token: play.token }]) // persist for hard-kill cleanup

  const o = obj?.data?.[0] ?? {}
  const em = o.episode_metadata ?? o.movie_metadata ?? {}
  const meta: StreamMeta = {
    title: o.title ?? '',
    seriesTitle: em.series_title ?? '',
    seasonNumber: em.season_number ?? null,
    episodeNumber: em.episode_number ?? null,
    durationMs: em.duration_ms ?? null,
    maturityRating: (em.maturity_ratings ?? [])[0] ?? null,
    maturitySystem: em.extended_maturity_rating?.system ?? null,
    descriptors: em.content_descriptors ?? []
  }

  return {
    accessToken: token,
    contentId: episodeId,
    assetId: play.assetId,
    videoToken: play.token,
    manifestUrl: play.url, // raw manifest (no burned-in subtitles)
    audioLocale: play.audioLocale,
    hardSubs: (play.hardSubs ?? {}) as Record<string, { url: string }>, // { locale: { url(manifest with subs burned in) } }
    versions: (play.versions ?? []) as AudioVersion[], // alternate audio dubs (each a separate guid)
    meta
  }
}

// Free the stream slot when playback ends (CR caps concurrent streams).
export async function releaseStream(contentId: string, videoToken: string) {
  if (!contentId || !videoToken) return
  try {
    await deleteToken(contentId, videoToken)
  } catch {
    /* best effort */
  }
  writeTokens(readTokens().filter((t) => t.token !== videoToken)) // forget it (released)
}
