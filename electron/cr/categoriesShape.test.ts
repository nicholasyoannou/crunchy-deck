import { describe, it, expect } from 'vitest'
import { categoriesUrl, categoriesUrlV1, mapCategories } from './categoriesShape'

const BASE = 'https://beta-api.crunchyroll.com'

describe('categories URLs', () => {
  it('v2 discover categories', () => {
    expect(categoriesUrl(BASE, 'en-US')).toBe(`${BASE}/content/v2/discover/categories?locale=en-US`)
  })
  it('v1 tenant_categories nests subcategories', () => {
    expect(categoriesUrlV1(BASE, 'en-US')).toBe(
      `${BASE}/content/v1/tenant_categories?include_subcategories=true&locale=en-US`
    )
  })
})

describe('mapCategories (normalises both generations)', () => {
  it('maps v2 data rows (id + localization.title)', () => {
    const res = {
      data: [
        { id: 'action', localization: { title: 'Action' } },
        { id: 'comedy', localization: { title: 'Comedy' } }
      ]
    }
    expect(mapCategories(res)).toEqual([
      { id: 'action', title: 'Action' },
      { id: 'comedy', title: 'Comedy' }
    ])
  })
  it('maps v1 items rows (tenant_category as id)', () => {
    const res = { items: [{ tenant_category: 'drama', localization: { title: 'Drama' } }] }
    expect(mapCategories(res)).toEqual([{ id: 'drama', title: 'Drama' }])
  })
  it('falls back title to id and drops rows with no id', () => {
    const res = { data: [{ id: 'x' }, { localization: { title: 'orphan' } }] }
    expect(mapCategories(res)).toEqual([{ id: 'x', title: 'x' }])
  })
  it('returns [] for malformed', () => {
    expect(mapCategories(null)).toEqual([])
    expect(mapCategories({})).toEqual([])
  })
})
