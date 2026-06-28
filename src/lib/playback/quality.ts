// Default video quality, persisted in localStorage. 'auto' = Shaka ABR; otherwise a target height the
// player locks to on load (nearest available <= target if the exact one isn't offered).
const KEY = 'cr.defaultQuality'
export type Quality = 'auto' | '1080' | '720' | '480' | '360' | '240'
export const QUALITY_OPTIONS: { value: Quality; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
  { value: '360', label: '360p' },
  { value: '240', label: '240p' }
]

export function getDefaultQuality(): Quality {
  try {
    const v = localStorage.getItem(KEY) as Quality | null
    return v && QUALITY_OPTIONS.some((o) => o.value === v) ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function setDefaultQuality(q: Quality): void {
  try {
    localStorage.setItem(KEY, q)
  } catch {
    /* ignore */
  }
}

// Given the heights a stream offers, resolve the default pref to a concrete height (or null = leave on
// ABR/auto). Picks the exact target, else the closest available at or below it, else the highest.
export function resolveQualityHeight(available: number[]): number | null {
  const pref = getDefaultQuality()
  if (pref === 'auto' || !available.length) return null
  const target = Number(pref)
  if (available.includes(target)) return target
  const atOrBelow = available.filter((h) => h <= target).sort((a, b) => b - a)
  return atOrBelow[0] ?? Math.max(...available)
}
