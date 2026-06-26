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
}

export interface CrRow {
  title: string
  items: CrItem[]
}

export interface CrHome {
  banners: CrBanner[]
  rows: CrRow[]
}
