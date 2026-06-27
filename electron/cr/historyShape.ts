// Pure, Electron-free helpers for Watch History. account_id sits directly under content/v2
// (NOT /discover/), like the watchlist mutation endpoints — pinned here by the tests.

export function watchHistoryUrl(base: string, accountId: string, locale: string, pageSize = 100, page = 1): string {
  return `${base}/content/v2/${accountId}/watch-history?page_size=${pageSize}&page=${page}&locale=${locale}`
}

export function historyItems(res: any): any[] {
  if (Array.isArray(res?.data)) return res.data
  if (Array.isArray(res?.items)) return res.items
  return []
}
