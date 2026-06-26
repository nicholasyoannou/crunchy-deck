import { crFetch, CR } from './client.js'
import { accessToken, accountId } from './auth.js'

// The cms/v2 seasons/episodes endpoints are authorized by signed query params (NOT Bearer),
// obtained from /index/v2 and valid for a while.
interface CmsCookie {
  bucket: string
  policy: string
  signature: string
  key_pair_id: string
  expires: number
}
let cms: CmsCookie | null = null

async function cmsCookie(): Promise<CmsCookie> {
  if (cms && Date.now() < cms.expires - 60_000) return cms
  const token = await accessToken()
  const res: any = await crFetch(`${CR.API}/index/v2`, { bearer: token })
  const c = res.cms
  cms = {
    bucket: c.bucket,
    policy: c.policy,
    signature: c.signature,
    key_pair_id: c.key_pair_id,
    expires: new Date(c.expires).getTime()
  }
  return cms
}

function sign(c: CmsCookie): string {
  return `Signature=${c.signature}&Policy=${c.policy}&Key-Pair-Id=${c.key_pair_id}`
}

export async function loadSeries(id: string, locale = 'en-US') {
  const token = await accessToken()
  const obj: any = await crFetch(`${CR.API}/content/v2/cms/objects/${id}?locale=${locale}`, { bearer: token })
  const series = obj?.data?.[0] ?? null

  let seasons: any[] = []
  try {
    const c = await cmsCookie()
    const s: any = await crFetch(`${CR.API}/cms/v2${c.bucket}/seasons?series_id=${id}&locale=${locale}&${sign(c)}`)
    seasons = s?.items ?? s?.data ?? []
  } catch {
    /* series still usable without seasons */
  }
  // Up-next (resume) episode for a "Continue Watching" button.
  let upNext: {
    id: string
    seasonNumber: number
    episodeNumber: number
    playhead: number
    fullyWatched: boolean
  } | null = null
  try {
    const un: any = await crFetch(`${CR.API}/content/v2/discover/up_next/${id}?locale=${locale}`, { bearer: token })
    const item = un?.data?.[0]
    if (item?.panel) {
      const em = item.panel.episode_metadata ?? {}
      upNext = {
        id: item.panel.id,
        seasonNumber: em.season_number ?? 0,
        episodeNumber: em.episode_number ?? 0,
        playhead: item.playhead ?? 0,
        fullyWatched: !!item.fully_watched
      }
    }
  } catch {
    /* no resume point */
  }

  return { series, seasons, upNext }
}

export async function loadEpisodes(seasonId: string, locale = 'en-US') {
  const c = await cmsCookie()
  const e: any = await crFetch(`${CR.API}/cms/v2${c.bucket}/episodes?season_id=${seasonId}&locale=${locale}&${sign(c)}`)
  const items: any[] = e?.items ?? e?.data ?? []

  // Merge watch progress (playheads) so the grid can show progress bars / watched state.
  try {
    const token = await accessToken()
    const id = accountId()
    const ids = items
      .map((x) => x.id)
      .filter(Boolean)
      .join(',')
    if (ids) {
      const ph: any = await crFetch(`${CR.API}/content/v2/${id}/playheads?content_ids=${ids}&locale=${locale}`, { bearer: token })
      const map = new Map<string, any>((ph?.data ?? []).map((p: any) => [p.content_id, p]))
      for (const it of items) {
        const p = map.get(it.id)
        if (p) {
          it.__playhead = p.playhead
          it.__fully_watched = p.fully_watched
        }
      }
    }
  } catch {
    /* progress optional */
  }

  return items
}
