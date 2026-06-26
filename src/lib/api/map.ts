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

    if (type === 'episode') {
      id = item.episode_metadata.series_id
      title = item.episode_metadata.series_title
      duration = Math.round(item.episode_metadata.duration_ms / 60000)
      display = 'episode'
      background = safe(() => item.images.thumbnail[0][4].source, placeholder(id))
    } else if (type === 'movie') {
      duration = Math.round(item.movie_metadata.duration_ms / 60000)
      display = 'episode'
      background = safe(() => item.images.thumbnail[0][4].source, placeholder(id))
    } else {
      background = safe(() => item.images.poster_wide[0][4].source, placeholder(id))
      poster = safe(() => item.images.poster_tall[0][2].source, placeholder(id))
    }

    return { id, display, type, title, description: item.description ?? '', background, poster, duration, playhead }
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
 */
export function mapHome(feed: any, itemsByRowIndex: any[][]): CrHome {
  const panels: any[] = feed?.data ?? []
  const bannerPanel = panels.find((p) => p?.resource_type === 'panel')
  const rowPanels = panels.filter(isRowPanel)
  const rows = mapRows(rowPanels.map((p, i) => ({ title: p.title, items: itemsByRowIndex[i] ?? [] })))
  return { banner: bannerPanel ? mapBanner(bannerPanel) : null, rows }
}
