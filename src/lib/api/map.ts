import type { CrItem, CrBanner, Display } from './types'

// Crunchyroll image arrays are arrays-of-arrays of size variants; access defensively.
export const placeholder = (id = '') =>
  `https://dummyimage.com/600x400/f48321/fff.png&text=${encodeURIComponent('CR ' + id)}`

function safe<T>(fn: () => T, fallback: T): T {
  try {
    const v = fn()
    return v == null ? fallback : v
  } catch {
    return fallback
  }
}

export function mapBanner(panel: any): CrBanner {
  const p = panel.panel ?? panel
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? '',
    background: safe(() => p.images.poster_wide[0][4].source, placeholder(p.id))
  }
}

// A browse/series object -> banner (used for the current-season simulcast hero).
function mapSeriesBanner(s: any): CrBanner | null {
  try {
    return {
      id: s.id,
      title: s.title,
      description: s.description ?? '',
      background: safe(() => {
        const v = s.images.poster_wide[0]
        return v[v.length - 1].source
      }, placeholder(s.title ?? ''))
    }
  } catch {
    return null
  }
}

// A hero_carousel item carries its own title/description plus a full content `panel`.
function mapHeroItem(item: any): CrBanner | null {
  try {
    const p = item.panel ?? item
    return {
      id: p.id ?? String(item.id),
      title: item.title ?? p.title ?? '',
      description: item.description ?? p.description ?? '',
      background: safe(
        () => p.images.poster_wide[0][4].source,
        safe(() => p.images.poster_tall[0][2].source, placeholder(item.title ?? ''))
      )
    }
  } catch {
    return null
  }
}

/** Preferred hero: current-season simulcasts; fall back to feed hero_carousel, then a promo panel. */
export function mapBanners(feed: any, heroItems: any[] = []): CrBanner[] {
  let banners: CrBanner[] = Array.isArray(heroItems)
    ? heroItems.map(mapSeriesBanner).filter((b: CrBanner | null): b is CrBanner => !!b)
    : []
  if (banners.length === 0) {
    const panels: any[] = feed?.data ?? []
    const hero = panels.find((p) => p?.resource_type === 'hero_carousel')
    banners = Array.isArray(hero?.items)
      ? hero.items.map(mapHeroItem).filter((b: CrBanner | null): b is CrBanner => !!b)
      : []
    if (banners.length === 0) {
      const single = panels.find((p) => p?.resource_type === 'panel')
      if (single) banners = [mapBanner(single)]
    }
  }
  return banners
}

function mapItem(raw: any): CrItem | null {
  try {
    const playhead = raw.playhead ? Math.round(raw.playhead / 60) : undefined
    const item = raw.panel ?? raw
    const type = item.type
    let id: string = item.id
    let display: Display = 'serie'
    let title: string = item.title
    let background: string
    let poster: string | undefined
    let duration: number | undefined
    let episodeNumber: number | undefined
    let seasonNumber: number | undefined
    let isPremium = false

    if (type === 'episode') {
      const em = item.episode_metadata
      id = em.series_id
      title = em.series_title
      duration = Math.round(em.duration_ms / 60000)
      episodeNumber = em.episode_number ?? undefined
      seasonNumber = em.season_number ?? undefined
      isPremium = !!em.is_premium_only
      display = 'episode'
      background = safe(() => item.images.thumbnail[0][4].source, placeholder(id))
    } else if (type === 'movie') {
      duration = Math.round(item.movie_metadata.duration_ms / 60000)
      isPremium = !!item.movie_metadata?.is_premium_only
      display = 'episode'
      background = safe(() => item.images.thumbnail[0][4].source, placeholder(id))
    } else {
      background = safe(() => item.images.poster_wide[0][4].source, placeholder(id))
      poster = safe(() => item.images.poster_tall[0][2].source, placeholder(id))
    }

    const isNew = !!(raw.new ?? item.new ?? item.episode_metadata?.is_new)

    return {
      id,
      display,
      type,
      title,
      description: item.description ?? '',
      background,
      poster,
      duration,
      playhead,
      episodeNumber,
      seasonNumber,
      isNew,
      isPremium
    }
  } catch {
    return null
  }
}

export function mapItems(items: any[]): CrItem[] {
  if (!Array.isArray(items)) return []
  return items.map(mapItem).filter((x): x is CrItem => x !== null)
}
