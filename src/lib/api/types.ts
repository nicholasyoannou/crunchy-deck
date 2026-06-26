export type Display = 'serie' | 'episode'

export interface CrItem {
  id: string
  display: Display
  type: string
  title: string
  description: string
  background: string
  poster?: string
  duration?: number // minutes
  playhead?: number // minutes
  episodeNumber?: number
  seasonNumber?: number
  isNew?: boolean
  isPremium?: boolean
}

export interface CrBanner {
  id: string
  title: string
  description: string
  background: string
  logo?: string // transparent show-logo art when available; otherwise the title text is used
}

export interface CrRow {
  title: string
  items: CrItem[]
}

// A row before its items are fetched (lazy-loaded on scroll).
export interface CrRowDescriptor {
  title: string
  link?: string
  ids?: string[]
}

export interface CrSeason {
  id: string
  title: string
  number: number
}

export interface CrEpisode {
  id: string
  title: string
  episodeNumber: number
  seasonNumber: number
  description: string
  background: string
  duration?: number // minutes
  premium: boolean
}

export interface CrSeriesInfo {
  id: string
  title: string
  description: string
  background: string
}
