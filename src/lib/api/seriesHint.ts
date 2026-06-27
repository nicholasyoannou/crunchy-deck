export type SeriesHint = {
  id: string
  title: string
  poster: string
  isPremium: boolean
}

let pending: SeriesHint | null = null

export function setHint(hint: SeriesHint): void {
  pending = hint
}

// Consume-once: returns the hint only if it matches `id`, then clears the slot
// either way so a later deep-link/refresh falls back to the full skeleton.
export function takeHint(id: string): SeriesHint | null {
  const hit = pending && pending.id === id ? pending : null
  pending = null
  return hit
}
