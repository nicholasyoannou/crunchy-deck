import { describe, it, expect } from 'vitest'
import { nearestInDirection, resolveOverride, type Focusable } from './spatial'

// 2x2 grid:  A B
//            C D
const grid: Focusable[] = [
  { id: 'A', rect: { x: 0, y: 0, width: 100, height: 100 } },
  { id: 'B', rect: { x: 200, y: 0, width: 100, height: 100 } },
  { id: 'C', rect: { x: 0, y: 200, width: 100, height: 100 } },
  { id: 'D', rect: { x: 200, y: 200, width: 100, height: 100 } }
]

describe('nearestInDirection', () => {
  it('moves right to the immediate neighbor', () => {
    expect(nearestInDirection('A', grid, 'right')).toBe('B')
  })
  it('moves down to the element below, not diagonal', () => {
    expect(nearestInDirection('A', grid, 'down')).toBe('C')
  })
  it('returns null at the edge', () => {
    expect(nearestInDirection('B', grid, 'right')).toBeNull()
  })
  it('prefers the nearer of two candidates in-line', () => {
    const row: Focusable[] = [
      { id: 'A', rect: { x: 0, y: 0, width: 50, height: 50 } },
      { id: 'B', rect: { x: 100, y: 0, width: 50, height: 50 } },
      { id: 'C', rect: { x: 400, y: 0, width: 50, height: 50 } }
    ]
    expect(nearestInDirection('A', row, 'right')).toBe('B')
  })
})

describe('resolveOverride', () => {
  it('returns the override target id when present', () => {
    expect(resolveOverride({ right: 'PLAY' }, 'right')).toBe('PLAY')
  })
  it('returns null when no override for that direction', () => {
    expect(resolveOverride({ up: 'X' }, 'down')).toBeNull()
  })
})
