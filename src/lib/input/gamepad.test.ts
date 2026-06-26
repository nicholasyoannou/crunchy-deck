import { describe, it, expect } from 'vitest'
import { buttonToCommand, AxisTracker } from './gamepad'

describe('buttonToCommand', () => {
  it('maps standard buttons', () => {
    expect(buttonToCommand(0)).toBe('confirm') // A
    expect(buttonToCommand(1)).toBe('cancel') // B
    expect(buttonToCommand(4)).toBe('prev') // LB
    expect(buttonToCommand(5)).toBe('next') // RB
    expect(buttonToCommand(9)).toBe('menu') // Start
    expect(buttonToCommand(12)).toBe('up')
    expect(buttonToCommand(15)).toBe('right')
  })
  it('returns null for unmapped buttons', () => {
    expect(buttonToCommand(16)).toBeNull()
  })
})

describe('AxisTracker hysteresis', () => {
  it('fires once when crossing the press threshold and not again until release', () => {
    const t = new AxisTracker(0.5, 0.3)
    expect(t.update(0.2, 0)).toBeNull() // below press
    expect(t.update(0.6, 0)).toBe('right') // cross press -> fire
    expect(t.update(0.7, 0)).toBeNull() // still held -> no refire
    expect(t.update(0.35, 0)).toBeNull() // above release -> still held
    expect(t.update(0.1, 0)).toBeNull() // below release -> reset (no fire)
    expect(t.update(0.6, 0)).toBe('right') // press again -> fire
  })
  it('uses the dominant axis', () => {
    const t = new AxisTracker(0.5, 0.3)
    expect(t.update(0.1, -0.9)).toBe('up') // y dominates, negative = up
    const t2 = new AxisTracker(0.5, 0.3)
    expect(t2.update(-0.9, 0.1)).toBe('left') // x dominates, negative = left
  })
})
