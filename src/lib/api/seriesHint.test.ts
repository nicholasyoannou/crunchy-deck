import { describe, it, expect } from 'vitest'
import { setHint, takeHint } from './seriesHint'

describe('seriesHint', () => {
  it('returns the hint once for a matching id, then clears it', () => {
    setHint({ id: 'S1', title: 'Naruto', poster: 'tall.jpg', isPremium: false })
    expect(takeHint('S1')).toMatchObject({ id: 'S1', title: 'Naruto', poster: 'tall.jpg', isPremium: false })
    expect(takeHint('S1')).toBeNull()
  })

  it('returns null for a non-matching id and still clears the pending hint', () => {
    setHint({ id: 'S1', title: 'Naruto', poster: 'tall.jpg', isPremium: false })
    expect(takeHint('S2')).toBeNull()
    expect(takeHint('S1')).toBeNull()
  })
})
