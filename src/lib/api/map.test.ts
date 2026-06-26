import { describe, it, expect } from 'vitest'
import { mapItems, mapBanner, mapHome, placeholder } from './map'

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

describe('mapHome', () => {
  const feed = {
    data: [
      { resource_type: 'panel', panel: { id: 'B1', title: 'Hero', description: '', images: { poster_wide: [[{}, {}, {}, {}, { source: 'hero.jpg' }]] } } },
      { response_type: 'series', title: 'Popular', ids: ['a'] },
      { response_type: 'history', title: 'Continue', ids: ['b'] },
      { response_type: 'musicvideo', title: 'Ignored', ids: ['c'] }
    ]
  }

  it('keeps only allow-listed, non-empty rows and maps the banner', () => {
    const home = mapHome(feed, [[seriesItem], [episodeItem]])
    expect(home.banner?.title).toBe('Hero')
    expect(home.rows.map((r) => r.title)).toEqual(['Popular', 'Continue'])
    expect(home.rows[0].items[0].id).toBe('S1')
    expect(home.rows[1].items[0].title).toBe('One Piece')
  })

  it('drops rows whose items failed to load', () => {
    const home = mapHome(feed, [[seriesItem], []])
    expect(home.rows.map((r) => r.title)).toEqual(['Popular'])
  })
})
