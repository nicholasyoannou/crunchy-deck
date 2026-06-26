import type { CrItem, CrBanner, CrRow, CrHome, Display } from './types'

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

// home_feed rows are panels whose response_type is one of these
const ROW_TYPES = new Set(['recommendations', 'history', 'browse', 'series', 'because_you_watched'])
export function isRowPanel(panel: any): boolean {
  return ROW_TYPES.has(panel?.response_type)
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
        const variants = s.images.poster_wide[0]
        return variants[variants.length - 1].source // biggest wide art
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

export function mapRows(rows: Array<{ title: string; items: any[] }>): CrRow[] {
  return rows.map((r) => ({ title: r.title, items: mapItems(r.items) })).filter((r) => r.items.length > 0)
}

/**
 * feed = raw home_feed JSON. itemsByRowIndex = items fetched per row, aligned to the
 * FILTERED row-panel order (the main process loads them in that order).
 * Banner = the hero_carousel's inline items (rotating); falls back to a single panel.
 */
export function mapHome(feed: any, itemsByRowIndex: any[][], heroItems: any[] = []): CrHome {
  const panels: any[] = feed?.data ?? []

  // Preferred hero: current-season simulcasts. Fall back to the feed's hero_carousel,
  // then to a single promo panel.
  let banners: CrBanner[] = Array.isArray(heroItems)
    ? heroItems.map(mapSeriesBanner).filter((b: CrBanner | null): b is CrBanner => !!b)
    : []
  if (banners.length === 0) {
    const hero = panels.find((p) => p?.resource_type === 'hero_carousel')
    banners = Array.isArray(hero?.items)
      ? hero.items.map(mapHeroItem).filter((b: CrBanner | null): b is CrBanner => !!b)
      : []
  }
  if (banners.length === 0) {
    const single = panels.find((p) => p?.resource_type === 'panel')
    if (single) banners = [mapBanner(single)]
  }

  const rowPanels = panels.filter(isRowPanel)
  const rows = mapRows(rowPanels.map((p, i) => ({ title: p.title, items: itemsByRowIndex[i] ?? [] })))
  return { banners, rows }
}
