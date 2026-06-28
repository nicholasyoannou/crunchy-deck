import { moveFocus } from './navigate'
import type { NavCommand } from './gamepad'
import { isNavOpen, isExitOpen, openNav, closeNav, openExit, closeExit } from '$lib/nav/overlays'
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
  if (!location.pathname.startsWith('/watch')) return false
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
  switch (cmd) {
    case 'up':
    case 'down':
      if (homeIntent(cmd)) break
      moveFocus(cmd) // overlays trap focus via [inert] on #app-content
      break
    case 'left':
      if (playerSeek(-10)) break
      if (isNavOpen() || isExitOpen()) break
      if (homeIntent('left')) break
      if (location.pathname.startsWith('/watch')) {
        moveFocus('left') // don't pop the nav menu over the player
        break
      }
      if (!moveFocus('left')) openNav() // LEFT at the left edge opens the menu
      break
    case 'right':
      if (playerSeek(10)) break
      if (isNavOpen()) {
        closeNav()
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
