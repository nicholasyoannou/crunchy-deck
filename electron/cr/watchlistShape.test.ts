import { describe, it, expect } from 'vitest'
import {
  watchlistListUrl,
  watchlistCheckUrl,
  watchlistAddUrl,
  watchlistRemoveUrl,
  isInWatchlist,
  watchlistItems
} from './watchlistShape'

const BASE = 'https://beta-api.crunchyroll.com'
const ACCT = 'acc-1'

describe('watchlist URLs (account_id placement footgun)', () => {
  it('LIST goes UNDER /discover/{accountId}/watchlist', () => {
    expect(watchlistListUrl(BASE, ACCT, 'en-US')).toBe(
      `${BASE}/content/v2/discover/acc-1/watchlist?order=desc&n=200&start=0&sort_by=date_added&locale=en-US`
    )
  })

  it('LIST honours custom paging', () => {
    expect(watchlistListUrl(BASE, ACCT, 'en-US', 50, 50)).toContain('&n=50&start=50&')
  })

  it('membership CHECK is NOT under /discover/ and passes content_ids', () => {
    expect(watchlistCheckUrl(BASE, ACCT, 'GR751KNZY', 'en-US')).toBe(
      `${BASE}/content/v2/acc-1/watchlist?content_ids=GR751KNZY&locale=en-US`
    )
  })

  it('ADD posts to the NON-/discover/ form by default, /discover/ as the 404 fallback', () => {
    expect(watchlistAddUrl(BASE, ACCT, 'en-US')).toBe(`${BASE}/content/v2/acc-1/watchlist?locale=en-US`)
    expect(watchlistAddUrl(BASE, ACCT, 'en-US', true)).toBe(
      `${BASE}/content/v2/discover/acc-1/watchlist?locale=en-US`
    )
  })

  it('REMOVE puts the content_id in the path, NOT under /discover/', () => {
    expect(watchlistRemoveUrl(BASE, ACCT, 'GR751KNZY', 'en-US')).toBe(
      `${BASE}/content/v2/acc-1/watchlist/GR751KNZY?locale=en-US`
    )
  })
})

describe('isInWatchlist', () => {
  it('true when the check response has any data row', () => {
    expect(isInWatchlist({ data: [{ id: 'x' }] })).toBe(true)
  })
  it('false for an empty or malformed response', () => {
    expect(isInWatchlist({ data: [] })).toBe(false)
    expect(isInWatchlist({})).toBe(false)
    expect(isInWatchlist(null)).toBe(false)
  })
})

describe('watchlistItems', () => {
  it('returns the data rows for mapItems (which reads each .panel)', () => {
    const res = { data: [{ panel: { id: 'a' } }, { panel: { id: 'b' } }], total: 2 }
    expect(watchlistItems(res)).toEqual([{ panel: { id: 'a' } }, { panel: { id: 'b' } }])
  })
  it('falls back to res.items, else []', () => {
    expect(watchlistItems({ items: [{ id: 'a' }] })).toEqual([{ id: 'a' }])
    expect(watchlistItems(null)).toEqual([])
    expect(watchlistItems({})).toEqual([])
  })
})
