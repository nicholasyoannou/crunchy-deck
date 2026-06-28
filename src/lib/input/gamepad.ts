export type NavCommand =
  | 'up' | 'down' | 'left' | 'right'
  | 'confirm' | 'cancel' | 'next' | 'prev' | 'menu' | 'search'
export type Direction = 'up' | 'down' | 'left' | 'right'

const BUTTON_MAP: Record<number, NavCommand> = {
  0: 'confirm', // A
  1: 'cancel', // B
  // L1/R1 (4/5) intentionally absent: skip back/forward are user-rebindable (default L1/R1) — see
  // input/bindings.ts. Keeping them out of the static map lets a binding move them off the bumpers
  // (e.g. to L2/R2) so the Steam+R1 screenshot chord stops triggering a skip.
  8: 'search', // Back/Select
  9: 'menu', // Start
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right'
}

export function buttonToCommand(index: number): NavCommand | null {
  return BUTTON_MAP[index] ?? null
}

// Treats an analog stick as a d-pad with separate press/release thresholds.
export class AxisTracker {
  private pressed = false
  constructor(private press = 0.5, private release = 0.3) {}

  update(x: number, y: number): Direction | null {
    const mag = Math.hypot(x, y)
    if (this.pressed) {
      if (mag < this.release) this.pressed = false
      return null
    }
    if (mag < this.press) return null
    this.pressed = true
    return Math.abs(x) >= Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up'
  }
}
