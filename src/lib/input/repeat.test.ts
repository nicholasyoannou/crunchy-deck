import { describe, it, expect } from 'vitest'
import { RepeatTimer } from './repeat'

describe('RepeatTimer', () => {
  it('fires immediately, waits the initial delay, then ramps', () => {
    const t = new RepeatTimer({ initialDelay: 320, startInterval: 120, minInterval: 45, ramp: 1000 })
    expect(t.press(0)).toBe(true) // first press fires
    expect(t.tick(100)).toBe(false) // within initial delay
    expect(t.tick(320)).toBe(true) // initial delay elapsed -> fire #2
    expect(t.tick(420)).toBe(false) // <interval since last
    expect(t.tick(440)).toBe(true) // interval elapsed -> fire #3
  })
  it('release stops repeats', () => {
    const t = new RepeatTimer({ initialDelay: 320, startInterval: 120, minInterval: 45, ramp: 1000 })
    t.press(0)
    t.release()
    expect(t.tick(1000)).toBe(false)
  })
})
