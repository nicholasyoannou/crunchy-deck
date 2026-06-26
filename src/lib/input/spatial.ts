export interface Rect { x: number; y: number; width: number; height: number }
export interface Focusable { id: string; rect: Rect }
export type Direction = 'up' | 'down' | 'left' | 'right'

function center(r: Rect) {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

// unit vector per direction (screen coords: +y is down)
const AXIS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
}

const CONE = Math.PI / 2.4 // ~75° half-cone: stay roughly on-axis

export function nearestInDirection(
  currentId: string,
  candidates: Focusable[],
  direction: Direction
): string | null {
  const current = candidates.find((c) => c.id === currentId)
  if (!current) return null
  const from = center(current.rect)
  const axis = AXIS[direction]

  let best: { id: string; score: number } | null = null
  for (const cand of candidates) {
    if (cand.id === currentId) continue
    const to = center(cand.rect)
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.hypot(dx, dy)
    if (dist === 0) continue
    // angle between the candidate vector and the direction axis
    const dot = (dx * axis.x + dy * axis.y) / dist
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
    if (angle > CONE) continue // outside the directional cone -> not a candidate
    // score: distance, penalized for being off-axis
    const score = dist * (1 + angle)
    if (!best || score < best.score) best = { id: cand.id, score }
  }
  return best ? best.id : null
}

export type Overrides = Partial<Record<Direction, string>>

export function resolveOverride(overrides: Overrides, direction: Direction): string | null {
  return overrides[direction] ?? null
}
