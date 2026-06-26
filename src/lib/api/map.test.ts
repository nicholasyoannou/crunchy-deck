import { describe, it, expect } from 'vitest'
import { mapItems, mapBanner, mapBanners, placeholder } from './map'

const seriesItem = {
  type: 'series',
  id: 'S1',
  title: 'Naruto',
  description: 'ninja',
  images: {
    poster_wide: [[{}, {}, {}, {}, { source: 'wide.jpg' }]],
    poster_tall: [[{}, {}, { source: 'tall.jpg' }]]
  }
}

const episodeItem = {
  type: 'episode',
  id: 'E1',
  description: 'd',
  playhead: 600, // seconds -> 10 min
  episode_metadata: { series_id: 'S9', series_title: 'One Piece', duration_ms: 1_440_000 }, // 24 min
  images: { thumbnail: [[{}, {}, {}, {}, { source: 'thumb.jpg' }]] }
}

describe('mapItems', () => {
  it('maps a series item to a poster card', () => {
    const [m] = mapItems([seriesItem])
    expect(m).toMatchObject({ id: 'S1', display: 'serie', title: 'Naruto', background: 'wide.jpg', poster: 'tall.jpg' })
  })

  it('maps an episode item using series metadata + playhead minutes', () => {
    const [m] = mapItems([episodeItem])
    expect(m).toMatchObject({ id: 'S9', display: 'episode', title: 'One Piece', background: 'thumb.jpg', duration: 24, playhead: 10 })
  })

  it('falls back to a placeholder when image nesting is missing (no throw)', () => {
    const [m] = mapItems([{ type: 'series', id: 'X', title: 't', images: {} }])
    expect(m.background).toBe(placeholder('X'))
  })

  it('unwraps a .panel wrapper', () => {
    const [m] = mapItems([{ playhead: 120, panel: seriesItem }])
    expect(m.id).toBe('S1')
    expect(m.playhead).toBe(2)
  })
})

describe('mapBanner', () => {
  it('maps the hero panel', () => {
    const b = mapBanner({
      panel: { id: 'B1', title: 'Featured', description: 'desc', images: { poster_wide: [[{}, {}, {}, {}, { source: 'hero.jpg' }]] } }
    })
    expect(b).toEqual({ id: 'B1', title: 'Featured', description: 'desc', background: 'hero.jpg' })
  })
})

describe('mapBanners', () => {
  it('falls back to a single promo panel when there are no hero items', () => {
    const feed = {
      data: [{ resource_type: 'panel', panel: { id: 'B1', title: 'Hero', description: '', images: { poster_wide: [[{}, {}, {}, {}, { source: 'hero.jpg' }]] } } }]
    }
    const banners = mapBanners(feed, [])
    expect(banners[0]?.title).toBe('Hero')
    expect(banners[0]?.background).toBe('hero.jpg')
  })

  it('uses hero_carousel items when present (and no simulcasts)', () => {
    const heroFeed = {
      data: [
        {
          resource_type: 'hero_carousel',
          items: [
            { title: 'One Piece', description: 'pirates', panel: { id: 'OP', images: { poster_wide: [[{}, {}, {}, {}, { source: 'op.jpg' }]] } } },
            { title: 'Bleach', description: 'shinigami', panel: { id: 'BL', images: { poster_wide: [[{}, {}, {}, {}, { source: 'bl.jpg' }]] } } }
          ]
        }
      ]
    }
    const banners = mapBanners(heroFeed, [])
    expect(banners.map((b) => b.title)).toEqual(['One Piece', 'Bleach'])
    expect(banners[0].background).toBe('op.jpg')
  })

  it('prefers current-season simulcast heroItems over the feed carousel', () => {
    const series = {
      id: 'WIS',
      title: 'Wistoria',
      description: 'mages',
      images: { poster_wide: [[{ source: 'wlo.jpg' }, { source: 'whi.jpg' }]] }
    }
    const banners = mapBanners({ data: [] }, [series])
    expect(banners.map((b) => b.title)).toEqual(['Wistoria'])
    expect(banners[0].background).toBe('whi.jpg') // biggest variant
  })
})
