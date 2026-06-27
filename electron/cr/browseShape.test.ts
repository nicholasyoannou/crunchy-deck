import { describe, it, expect } from 'vitest'
import { browseUrl, browseUrlV1, browseItems } from './browseShape'

const BASE = 'https://beta-api.crunchyroll.com'

describe('browseUrl (v2 discover)', () => {
  it('defaults to popularity/series with paging + locale', () => {
    expect(browseUrl(BASE, 'en-US', {})).toBe(
      `${BASE}/content/v2/discover/browse?n=20&start=0&sort_by=popularity&type=series&locale=en-US`
    )
  })
  it('adds categories + seasonal_tag (v2 spelling), encoded, with custom sort/paging', () => {
    const u = browseUrl(BASE, 'en-US', {
      categories: 'action',
      seasonalTag: 'spring-2026',
      sortBy: 'newly_added',
      n: 24,
      start: 24
    })
    expect(u).toContain('n=24&start=24&sort_by=newly_added&type=series')
    expect(u).toContain('&categories=action')
    expect(u).toContain('&seasonal_tag=spring-2026')
  })
})

describe('browseUrlV1 (legacy fallback)', () => {
  it('uses season_tag (no "al") and omits type', () => {
    const u = browseUrlV1(BASE, 'en-US', { seasonalTag: 'spring-2026' })
    expect(u.startsWith(`${BASE}/content/v1/browse?`)).toBe(true)
    expect(u).toContain('&season_tag=spring-2026')
    expect(u).not.toContain('seasonal_tag')
    expect(u).not.toContain('type=')
  })
})

describe('browseItems', () => {
  it('reads v2 res.data', () => {
    expect(browseItems({ data: [{ id: 'a' }] })).toEqual([{ id: 'a' }])
  })
  it('falls back to v1 res.items, else []', () => {
    expect(browseItems({ items: [{ id: 'b' }] })).toEqual([{ id: 'b' }])
    expect(browseItems(null)).toEqual([])
    expect(browseItems({})).toEqual([])
  })
})
