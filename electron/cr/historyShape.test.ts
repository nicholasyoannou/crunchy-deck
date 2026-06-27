import { describe, it, expect } from 'vitest'
import { watchHistoryUrl, historyItems } from './historyShape'

const BASE = 'https://beta-api.crunchyroll.com'

describe('watchHistoryUrl', () => {
  it('puts account_id directly under content/v2 (NOT /discover/) with paging', () => {
    expect(watchHistoryUrl(BASE, 'acc-1', 'en-US')).toBe(
      `${BASE}/content/v2/acc-1/watch-history?page_size=100&page=1&locale=en-US`
    )
  })
  it('honours custom page + page size', () => {
    expect(watchHistoryUrl(BASE, 'acc-1', 'en-US', 50, 3)).toContain('page_size=50&page=3')
  })
})

describe('historyItems', () => {
  it('returns data rows (mapItems reads each .panel)', () => {
    const res = { data: [{ panel: { id: 'e1' } }, { panel: { id: 'e2' } }] }
    expect(historyItems(res)).toEqual([{ panel: { id: 'e1' } }, { panel: { id: 'e2' } }])
  })
  it('falls back to res.items, else []', () => {
    expect(historyItems({ items: [{ id: 'x' }] })).toEqual([{ id: 'x' }])
    expect(historyItems(null)).toEqual([])
    expect(historyItems({})).toEqual([])
  })
})
