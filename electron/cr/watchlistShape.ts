// Pure, Electron-free helpers for the Watchlist feature. Kept separate from watchlist.ts
// (which imports the electron auth chain) so the URL shapes + predicates are unit-testable.
// NB the account_id placement is INCONSISTENT across CR's watchlist endpoints — these
// builders pin it: LIST is under /discover/, but check/add/remove are NOT.

export function watchlistListUrl(base: string, accountId: string, locale: string, n = 200, start = 0): string {
  return `${base}/content/v2/discover/${accountId}/watchlist?order=desc&n=${n}&start=${start}&sort_by=date_added&locale=${locale}`
}

export function watchlistCheckUrl(base: string, accountId: string, contentId: string, locale: string): string {
  return `${base}/content/v2/${accountId}/watchlist?content_ids=${contentId}&locale=${locale}`
}

// Default form is the one proven in the reference client; pass discover=true for the
// /discover/ fallback to try on a 404.
export function watchlistAddUrl(base: string, accountId: string, locale: string, discover = false): string {
  return `${base}/content/v2/${discover ? 'discover/' : ''}${accountId}/watchlist?locale=${locale}`
}

export function watchlistRemoveUrl(base: string, accountId: string, contentId: string, locale: string): string {
  return `${base}/content/v2/${accountId}/watchlist/${contentId}?locale=${locale}`
}

// The membership-check endpoint echoes back the queried ids that ARE in the list.
export function isInWatchlist(res: any): boolean {
  return Array.isArray(res?.data) && res.data.length > 0
}

// List rows for mapItems (each row carries the content under `.panel`, which mapItems reads).
export function watchlistItems(res: any): any[] {
  if (Array.isArray(res?.data)) return res.data
  if (Array.isArray(res?.items)) return res.items
  return []
}
