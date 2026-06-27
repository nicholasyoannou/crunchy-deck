import { describe, it, expect } from 'vitest'
import { seasonalTagsUrl, mapSeasonalTags } from './seasonsShape'

const BASE = 'https://beta-api.crunchyroll.com'

describe('seasonalTagsUrl', () => {
  it('hits discover/seasonal_tags', () => {
    expect(seasonalTagsUrl(BASE, 'en-US')).toBe(`${BASE}/content/v2/discover/seasonal_tags?locale=en-US`)
  })
})

describe('mapSeasonalTags', () => {
  it('maps data rows to {id,title}, order preserved (newest first)', () => {
    const res = {
      data: [
        { id: 'spring-2026', localization: { title: 'Spring 2026' } },
        { id: 'winter-2026', localization: { title: 'Winter 2026' } }
      ]
    }
    expect(mapSeasonalTags(res)).toEqual([
      { id: 'spring-2026', title: 'Spring 2026' },
      { id: 'winter-2026', title: 'Winter 2026' }
    ])
  })
  it('falls back title to id; [] for malformed', () => {
    expect(mapSeasonalTags({ data: [{ id: 'q1' }] })).toEqual([{ id: 'q1', title: 'q1' }])
    expect(mapSeasonalTags(null)).toEqual([])
    expect(mapSeasonalTags({})).toEqual([])
  })
})
