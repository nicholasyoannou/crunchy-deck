// User-configurable L1/R1 skip interval (seconds), persisted in localStorage so the player + settings
// share it without IPC. Default 3s.
const KEY = 'cr.skipSeconds'
export const SKIP_OPTIONS = [3, 5, 10, 15, 30]

export function getSkipSeconds(): number {
  try {
    const v = Number(localStorage.getItem(KEY))
    return Number.isFinite(v) && v > 0 ? v : 3
  } catch {
    return 3
  }
}

export function setSkipSeconds(n: number): void {
  try {
    localStorage.setItem(KEY, String(n))
  } catch {
    /* ignore */
  }
}
