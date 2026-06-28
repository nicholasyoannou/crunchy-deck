import { buttonToCommand, type NavCommand } from './gamepad'

// User-rebindable gamepad buttons for the in-player skip back / forward, persisted in localStorage.
// Defaults are the L1/R1 bumpers. Rebinding lets the user move skip off R1 so the Steam+R1 screenshot
// chord (which the app can't see the Steam button of) stops also skipping the video.
const KEY_FWD = 'cr.bind.skipForward'
const KEY_BACK = 'cr.bind.skipBack'
export const DEFAULT_SKIP_FORWARD = 5 // R1
export const DEFAULT_SKIP_BACK = 4 // L1

function read(key: string, def: number): number {
  try {
    const v = Number(localStorage.getItem(key))
    return Number.isInteger(v) && v >= 0 && v <= 31 ? v : def
  } catch {
    return def
  }
}
export const getSkipForwardBtn = (): number => read(KEY_FWD, DEFAULT_SKIP_FORWARD)
export const getSkipBackBtn = (): number => read(KEY_BACK, DEFAULT_SKIP_BACK)
export function setSkipForwardBtn(i: number): void {
  try {
    localStorage.setItem(KEY_FWD, String(i))
  } catch {
    /* ignore */
  }
}
export function setSkipBackBtn(i: number): void {
  try {
    localStorage.setItem(KEY_BACK, String(i))
  } catch {
    /* ignore */
  }
}

// Standard-mapping gamepad button index -> friendly Steam Deck label.
const BTN_NAMES: Record<number, string> = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'L1',
  5: 'R1',
  6: 'L2',
  7: 'R2',
  8: 'View',
  9: 'Menu',
  10: 'L3',
  11: 'R3',
  12: 'D-pad Up',
  13: 'D-pad Down',
  14: 'D-pad Left',
  15: 'D-pad Right',
  16: 'Guide'
}
export const buttonName = (i: number): string => BTN_NAMES[i] ?? `Button ${i}`

// Resolve a gamepad button index to a command: user-bound skip first, then the static nav map.
export function resolveButton(i: number): NavCommand | null {
  if (i === getSkipForwardBtn()) return 'next'
  if (i === getSkipBackBtn()) return 'prev'
  return buttonToCommand(i)
}

// One-shot "press a button to bind it" capture. While a callback is armed the poller routes the next
// button rising-edge here (consuming it, so it doesn't also fire a command) instead of dispatching.
let captureCb: ((index: number) => void) | null = null
export function armButtonCapture(cb: (index: number) => void): void {
  captureCb = cb
}
export function cancelButtonCapture(): void {
  captureCb = null
}
export function isCapturing(): boolean {
  return captureCb !== null
}
// Returns true if the press was consumed for a rebind.
export function feedCapture(index: number): boolean {
  if (!captureCb) return false
  const cb = captureCb
  captureCb = null
  cb(index)
  return true
}
