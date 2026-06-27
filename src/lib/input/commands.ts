import { moveFocus } from './navigate'
import type { NavCommand } from './gamepad'
import { isNavOpen, isExitOpen, openNav, closeNav, openExit, closeExit } from '$lib/nav/overlays'

// When the video player's scrub bar is focused, Left/Right SEEK instead of moving focus.
function playerSeek(delta: number): boolean {
  const a = document.activeElement as HTMLElement | null
  if (a && a.dataset.playerSeek !== undefined) {
    window.dispatchEvent(new CustomEvent('cr:seek', { detail: delta }))
    return true
  }
  return false
}

// Single entry point for ALL input sources (gamepad, keyboard, on-screen test pad).
export function dispatchCommand(cmd: NavCommand) {
  window.cr?.log(`[cmd] ${cmd} @ ${location.pathname}`) // TEMP diagnostics
  switch (cmd) {
    case 'up':
    case 'down':
      moveFocus(cmd) // overlays trap focus via [inert] on #app-content
      break
    case 'left':
      if (playerSeek(-10)) break
      if (isNavOpen() || isExitOpen()) break
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
      moveFocus('left') // L1 — placeholder until section paging lands
      break
    case 'next':
      moveFocus('right') // R1 — placeholder
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
