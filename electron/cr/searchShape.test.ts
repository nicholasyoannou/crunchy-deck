import { describe, it, expect } from 'vitest'
import { buildSearchUrl, flattenSearchResults } from './searchShape'

describe('buildSearchUrl', () => {
  it('url-encodes the query and pins type/n/start/locale', () => {
    expect(buildSearchUrl('https://beta-api.crunchyroll.com', 'cowboy bebop', 'en-US')).toBe(
      'https://beta-api.crunchyroll.com/content/v2/discover/search?q=cowboy%20bebop&n=100&start=0&type=series,movie_listing&locale=en-US'
    )
  })

  it('escapes reserved characters in the query so they are not read as params', () => {
    expect(buildSearchUrl('https://x', 'a&b=c', 'en-US')).toContain('q=a%26b%3Dc')
  })

  it('honours a custom result count', () => {
    expect(buildSearchUrl('https://x', 'naruto', 'en-US', 6)).toContain('&n=6&')
  })
})

describe('flattenSearchResults', () => {
  it('concatenates items across grouped buckets, preserving order', () => {
    const res = {
      data: [
        { type: 'series', count: 2, items: [{ id: 's1' }, { id: 's2' }] },
        { type: 'movie_listing', count: 1, items: [{ id: 'm1' }] }
      ]
    }
    expect(flattenSearchResults(res)).toEqual([{ id: 's1' }, { id: 's2' }, { id: 'm1' }])
  })

  it('falls back to a flat data array that has no nested items', () => {
    const res = { data: [{ id: 'a' }, { id: 'b' }] }
    expect(flattenSearchResults(res)).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  it('falls back to res.items for v1-style responses', () => {
    expect(flattenSearchResults({ items: [{ id: 'x' }] })).toEqual([{ id: 'x' }])
  })

  it('returns [] for empty or malformed responses', () => {
    expect(flattenSearchResults(null)).toEqual([])
    expect(flattenSearchResults({})).toEqual([])
    expect(flattenSearchResults({ data: [] })).toEqual([])
  })
})
