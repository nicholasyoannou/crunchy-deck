// Pure, Electron-free helpers for Browse. v2 discover is the lead; v1 is the proven fallback.
// The two generations differ: v2 uses seasonal_tag + res.data, v1 uses season_tag + res.items.

export interface BrowseOpts {
  sortBy?: string
  type?: string
  categories?: string
  seasonalTag?: string
  n?: number
  start?: number
}

export function browseUrl(base: string, locale: string, opts: BrowseOpts = {}): string {
  const { sortBy = 'popularity', type = 'series', n = 20, start = 0, categories, seasonalTag } = opts
  let u = `${base}/content/v2/discover/browse?n=${n}&start=${start}&sort_by=${sortBy}&type=${type}`
  if (categories) u += `&categories=${encodeURIComponent(categories)}`
  if (seasonalTag) u += `&seasonal_tag=${encodeURIComponent(seasonalTag)}`
  return `${u}&locale=${locale}`
}

export function browseUrlV1(base: string, locale: string, opts: BrowseOpts = {}): string {
  const { sortBy = 'popularity', n = 20, start = 0, categories, seasonalTag } = opts
  let u = `${base}/content/v1/browse?n=${n}&start=${start}&sort_by=${sortBy}`
  if (categories) u += `&categories=${encodeURIComponent(categories)}`
  if (seasonalTag) u += `&season_tag=${encodeURIComponent(seasonalTag)}` // NB season_tag (no "al")
  return `${u}&locale=${locale}`
}

export function browseItems(res: any): any[] {
  if (Array.isArray(res?.data)) return res.data
  if (Array.isArray(res?.items)) return res.items
  return []
}
