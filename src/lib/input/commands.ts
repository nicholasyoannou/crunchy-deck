import { moveFocus } from './navigate'
import type { NavCommand } from './gamepad'
import { isNavOpen, isExitOpen, openNav, closeNav, openExit, closeExit } from '$lib/nav/overlays'
import { isPickerOpen, closePicker } from '$lib/ui/picker'
import { getSkipSeconds } from '$lib/playback/skip'
import { isSteamChordActive } from './steamChord'

// When the video player's scrub bar is focused, Left/Right SEEK instead of moving focus.
function playerSeek(delta: number): boolean {
  const a = document.activeElement as HTMLElement | null
  if (a && a.dataset.playerSeek !== undefined) {
    window.dispatchEvent(new CustomEvent('cr:seek', { detail: delta }))
    return true
  }
  return false
}

// L1/R1 anywhere in the player skip by the user-configured interval (default 3s).
function playerSkip(delta: number): boolean {
  if (!location.pathname.startsWith('/watch/')) return false // /watch/[id] only — NOT /watchlist
  // Holding the Steam button runs a Steam chord (Steam+shoulder etc.); don't let the shoulder press
  // that leaks through also fast-forward the video. Consume it (return true) so it neither seeks nor
  // falls through to moving focus.
  if (isSteamChordActive()) {
    window.cr?.log('[skip] suppressed (steam chord)')
    return true
  }
  window.dispatchEvent(new CustomEvent('cr:seek', { detail: delta }))
  return true
}

// Home starts with NOTHING focused so the hero carousel auto-advances. Resolve the first D-pad press
// by intent: up/right -> hero, down -> Continue Watching, left -> menu. Once something real is focused,
// fall through to normal spatial nav.
function homeIntent(cmd: NavCommand): boolean {
  if (location.pathname !== '/home') return false
  const a = document.activeElement as HTMLElement | null
  if (a && a.id && a.id !== 'app-content') return false
  if (cmd === 'down') document.getElementById('r0i0')?.focus()
  else if (cmd === 'left') openNav()
  else if (cmd === 'up' || cmd === 'right') document.getElementById('hero-play')?.focus()
  else return false
  return true
}

// Single entry point for ALL input sources (gamepad, keyboard, on-screen test pad).
export function dispatchCommand(cmd: NavCommand) {
  window.cr?.log(`[cmd] ${cmd} @ ${location.pathname}`) // TEMP diagnostics
  // A single-select overlay (language picker) traps input: D-pad moves within its list, A selects,
  // B closes. The page beneath is [inert] so moveFocus only sees the picker's options.
  if (isPickerOpen()) {
    if (cmd === 'up' || cmd === 'down') moveFocus(cmd)
    else if (cmd === 'confirm') (document.activeElement as HTMLElement | null)?.click()
    else if (cmd === 'cancel') closePicker()
    return
  }
  switch (cmd) {
    case 'up':
    case 'down':
      if (homeIntent(cmd)) break
      moveFocus(cmd) // overlays trap focus via [inert] on #app-content
      break
    case 'left':
      if (playerSeek(-10)) break
      if (isExitOpen()) break
      if (isNavOpen()) {
        // inside the open menu, Left only walks back from the footer gear to the profile button;
        // at the left-anchored edge it does nothing (use Back/B to close).
        if ((document.activeElement as HTMLElement | null)?.id === 'nav-settings') moveFocus('left')
        break
      }
      if (homeIntent('left')) break
      if (location.pathname.startsWith('/watch/')) {
        moveFocus('left') // /watch/[id] only — NOT /watchlist — so the menu still opens on the watchlist
        break
      }
      if (!moveFocus('left')) openNav() // LEFT at the left edge opens the menu
      break
    case 'right':
      if (playerSeek(10)) break
      if (isNavOpen()) {
        // the footer profile button has the settings gear to its right — move to it. Every other item
        // (the full-width rows) has nothing to its right, so Right closes the menu as before.
        if ((document.activeElement as HTMLElement | null)?.id === 'nav-profiles') moveFocus('right')
        else closeNav()
        break
      }
      if (homeIntent('right')) break
      moveFocus('right')
      break
    case 'confirm':
      ;(document.activeElement as HTMLElement | null)?.click()
      break
    case 'cancel':
      if (document.getElementById('pl-menu')) {
        window.dispatchEvent(new CustomEvent('cr:closemenu')) // close the player's settings panel first
        break
      }
      if (isNavOpen()) {
        closeNav()
        break
      }
      if (isExitOpen()) {
        closeExit()
        break
      }
      // Back at a top-level route would otherwise dead-end; confirm exit instead.
      if (location.pathname === '/home' || location.pathname === '/') openExit()
      else history.back()
      break
    case 'prev':
      if (playerSkip(-getSkipSeconds())) break // L1 -> rewind by the configured interval
      moveFocus('left')
      break
    case 'next':
      if (playerSkip(getSkipSeconds())) break // R1 -> forward by the configured interval
      moveFocus('right')
      break
    case 'menu':
      if (isNavOpen()) closeNav()
      else openNav()
      break
    case 'search':
      window.dispatchEvent(new CustomEvent('cr:search'))
      break
  }
}
