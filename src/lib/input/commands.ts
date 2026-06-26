import { moveFocus } from './navigate'
import type { NavCommand } from './gamepad'

// Single entry point for ALL input sources (gamepad, keyboard, on-screen test pad).
export function dispatchCommand(cmd: NavCommand) {
  switch (cmd) {
    case 'up':
    case 'down':
    case 'left':
    case 'right':
      moveFocus(cmd)
      break
    case 'confirm':
      ;(document.activeElement as HTMLElement | null)?.click()
      break
    case 'cancel':
      history.back()
      break
    case 'prev':
      moveFocus('left') // L1 — placeholder until section paging lands
      break
    case 'next':
      moveFocus('right') // R1 — placeholder
      break
    case 'menu':
      window.dispatchEvent(new CustomEvent('cr:menu'))
      break
    case 'search':
      window.dispatchEvent(new CustomEvent('cr:search'))
      break
  }
}
