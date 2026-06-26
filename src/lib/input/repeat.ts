export interface RepeatConfig {
  initialDelay: number
  startInterval: number
  minInterval: number
  ramp: number // ms over which interval eases from start -> min
}

export class RepeatTimer {
  private heldSince: number | null = null
  private lastFire = 0
  constructor(private cfg: RepeatConfig) {}

  press(now: number): boolean {
    this.heldSince = now
    this.lastFire = now
    return true
  }

  release() {
    this.heldSince = null
  }

  private intervalAt(now: number): number {
    const held = now - (this.heldSince ?? now)
    const elapsed = Math.max(0, held - this.cfg.initialDelay)
    const f = Math.min(1, elapsed / this.cfg.ramp)
    return this.cfg.startInterval + (this.cfg.minInterval - this.cfg.startInterval) * f
  }

  tick(now: number): boolean {
    if (this.heldSince === null) return false
    const sinceHold = now - this.heldSince
    if (sinceHold < this.cfg.initialDelay) return false
    if (now - this.lastFire >= this.intervalAt(now) - 1e-6) {
      this.lastFire = now
      return true
    }
    return false
  }
}
