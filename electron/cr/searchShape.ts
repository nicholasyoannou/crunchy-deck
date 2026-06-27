// Pure, Electron-free helpers for the Search feature (mirrors the deviceCode.ts/device.ts
// split so the shaping logic is unit-testable without the electron auth chain).

// Build the discover/search URL. type is pinned to series,movie_listing (the menu-relevant
// content) and the query is url-encoded so reserved chars aren't read as extra params.
export function buildSearchUrl(base: string, query: string, locale: string, n = 100): string {
  return `${base}/content/v2/discover/search?q=${encodeURIComponent(query)}&n=${n}&start=0&type=series,movie_listing&locale=${locale}`
}

// discover/search returns grouped buckets ({ data: [{ type, items: [...] }] }); flatten the
// per-type buckets into one ordered list of content objects for mapItems(). Tolerates the
// flat-array and v1 res.items shapes too.
export function flattenSearchResults(res: any): any[] {
  if (!res) return []
  const data = res.data
  if (Array.isArray(data)) {
    if (data.some((g: any) => Array.isArray(g?.items))) {
      return data.flatMap((g: any) => (Array.isArray(g?.items) ? g.items : []))
    }
    return data
  }
  if (Array.isArray(res.items)) return res.items
  return []
}
