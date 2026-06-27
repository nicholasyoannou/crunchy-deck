import { crFetch, CR } from './client.js'
import { accessToken } from './auth.js'

// Skip markers (intro/credits/recap/preview) live on a static CDN object — no auth, 404 = none.
// Shape recovered from the CR APK + reference client: { intro?:{start,end,type}, credits?:{...}, ... }
// with start/end in SECONDS. https://static.crunchyroll.com/skip-events/production/{episodeId}.json
export interface SkipBlock {
  start: number
  end: number
  type?: string
}
export interface SkipMarkers {
  intro: SkipBlock | null
  credits: SkipBlock | null
  recap: SkipBlock | null
  preview: SkipBlock | null
}

export async function skipMarkers(episodeId: string): Promise<SkipMarkers> {
  const empty: SkipMarkers = { intro: null, credits: null, recap: null, preview: null }
  try {
    const j: any = await crFetch(`${CR.STATIC}/skip-events/production/${episodeId}.json`) // static CDN, no bearer
    const pick = (b: any): SkipBlock | null =>
      b && b.end != null ? { start: b.start ?? 0, end: b.end, type: b.type } : null
    return { intro: pick(j?.intro), credits: pick(j?.credits), recap: pick(j?.recap), preview: pick(j?.preview) }
  } catch {
    return empty // 404 (no markers) is normal — never throw
  }
}

// The NEXT episode after a given EPISODE id (not series). Same up_next endpoint as the series resume,
// but seeded with an episode guid -> data[0].panel is the following episode (null at end of series).
export interface NextEpisode {
  id: string
  title: string
  seriesTitle: string
  seasonNumber: number | null
  episodeNumber: number | null
  durationMs: number | null
  description: string
  thumbnail: string | null
}

export async function nextEpisode(episodeId: string, locale = 'en-US'): Promise<NextEpisode | null> {
  try {
    const token = await accessToken()
    const un: any = await crFetch(`${CR.API}/content/v2/discover/up_next/${episodeId}?locale=${locale}`, { bearer: token })
    const p = un?.data?.[0]?.panel
    if (!p?.id) return null
    const em = p.episode_metadata ?? {}
    const thumbs = p.images?.thumbnail?.[0]
    return {
      id: p.id,
      title: p.title ?? '',
      seriesTitle: em.series_title ?? '',
      seasonNumber: em.season_number ?? null,
      episodeNumber: em.episode_number ?? null,
      durationMs: em.duration_ms ?? null,
      description: p.description ?? '',
      thumbnail: Array.isArray(thumbs) ? (thumbs[thumbs.length - 1]?.source ?? null) : null
    }
  } catch {
    return null
  }
}
