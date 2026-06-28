import { buttonToCommand, type NavCommand } from './gamepad'

// User-rebindable gamepad buttons for the in-player skip back / forward, persisted in localStorage.
// Defaults are the L2/R2 triggers (so the Steam+R1 screenshot chord can't trigger a skip). Skip can
// ONLY be bound to a shoulder/trigger — never a nav button (A/B/D-pad) — so a rebind can't hijack
// navigation (an accidental "bind skip to A" once made A stop selecting + start skipping).
const KEY_FWD = 'cr.bind.skipForward'
const KEY_BACK = 'cr.bind.skipBack'
export const DEFAULT_SKIP_FORWARD = 7 // R2
export const DEFAULT_SKIP_BACK = 6 // L2

// The only buttons a skip can live on: L1 / R1 / L2 / R2.
export const BINDABLE = new Set([4, 5, 6, 7])

function read(key: string, def: number): number {
  try {
    const v = Number(localStorage.getItem(key))
    return BINDABLE.has(v) ? v : def // ignore stale/invalid binds (e.g. a face button) -> default
  } catch {
    return def
  }
}
export const getSkipForwardBtn = (): number => read(KEY_FWD, DEFAULT_SKIP_FORWARD)
export const getSkipBackBtn = (): number => read(KEY_BACK, DEFAULT_SKIP_BACK)
export function setSkipForwardBtn(i: number): void {
  if (!BINDABLE.has(i)) return
  try {
    localStorage.setItem(KEY_FWD, String(i))
  } catch {
    /* ignore */
  }
}
export function setSkipBackBtn(i: number): void {
  if (!BINDABLE.has(i)) return
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

// Resolve a gamepad button index to a command. Nav map FIRST (A/B/D-pad/etc. ALWAYS keep their nav
// action — a skip bind can never override them), then the user skip binds (which only ever sit on the
// L1/R1/L2/R2 buttons, none of which are in the nav map).
export function resolveButton(i: number): NavCommand | null {
  const nav = buttonToCommand(i)
  if (nav) return nav
  if (i === getSkipForwardBtn()) return 'next'
  if (i === getSkipBackBtn()) return 'prev'
  return null
}

// One-shot "press a button to bind it" capture. While armed the poller routes the next button
// rising-edge here (consuming it, so it doesn't fire a command). Only L1/R1/L2/R2 actually bind; other
// presses are swallowed (so they don't navigate) but leave the capture armed.
let captureCb: ((index: number) => void) | null = null
export function armButtonCapture(cb: (index: number) => void): void {
  captureCb = cb
}
export function cancelButtonCapture(): void {
  captureCb = null
}
// Returns true if the press was consumed by an armed capture.
export function feedCapture(index: number): boolean {
  if (!captureCb) return false
  if (BINDABLE.has(index)) {
    const cb = captureCb
    captureCb = null
    cb(index)
  }
  return true // swallow every press while capturing (non-bindable ones just keep waiting)
}
