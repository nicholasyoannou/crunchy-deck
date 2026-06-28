import { AxisTracker, type NavCommand, type Direction } from './gamepad'
import { resolveButton, feedCapture } from './bindings'
import { RepeatTimer } from './repeat'
import { setInputType } from './inputType'
import { dispatchCommand } from './commands'

export function startGamepadPoller() {
  const axis = new AxisTracker(0.5, 0.3)
  const repeat = new RepeatTimer({ initialDelay: 320, startInterval: 120, minInterval: 45, ramp: 1000 })
  // separate accelerating repeat for the skip buttons: hold to fast-forward / rewind in the player.
  const skipRepeat = new RepeatTimer({ initialDelay: 350, startInterval: 280, minInterval: 110, ramp: 1800 })
  const prevButtons = new Map<number, boolean>()
  let heldDir: Direction | null = null
  let heldSkipBtn: number | null = null
  let heldSkipCmd: NavCommand | null = null
  let raf = 0

  // TEMP input diagnostics — reveals what the Steam Deck emits per physical button so the
  // back/menu mappings can be fixed against real evidence. Remove once mapping is confirmed.
  const onKeyLog = (e: KeyboardEvent) => window.cr?.log(`[key] ${e.key}`)
  window.addEventListener('keydown', onKeyLog)

  const now = () => performance.now()

  const dispatch = (cmd: NavCommand) => dispatchCommand(cmd)

  const loop = () => {
    const pads = navigator.getGamepads?.() ?? []
    for (const pad of pads) {
      if (!pad) continue
      setInputType('dpad')

      // buttons: fire on rising edge; HOLD a skip button to fast-forward/rewind in the player
      pad.buttons.forEach((b, i) => {
        const pressed = b.pressed
        const wasPressed = prevButtons.get(i) ?? false
        if (pressed && !wasPressed) {
          // a Settings rebind capture eats the next press; otherwise resolve (nav map first, then user
          // skip binds) and dispatch.
          if (!feedCapture(i)) {
            const cmd = resolveButton(i)
            window.cr?.log(`[gp] btn=${i} cmd=${cmd ?? 'none'}`) // TEMP diagnostics
            if (cmd) dispatch(cmd)
            if ((cmd === 'next' || cmd === 'prev') && location.pathname.startsWith('/watch/')) {
              heldSkipBtn = i // start the hold -> continuous scrub
              heldSkipCmd = cmd
              skipRepeat.press(now())
            }
          }
        } else if (pressed && wasPressed && i === heldSkipBtn) {
          if (skipRepeat.tick(now()) && heldSkipCmd) dispatch(heldSkipCmd) // repeat while held
        } else if (!pressed && wasPressed && i === heldSkipBtn) {
          heldSkipBtn = null // released -> stop scrubbing
          skipRepeat.release()
        }
        prevButtons.set(i, pressed)
      })

      // left stick -> direction with hysteresis + accelerating repeat
      const dir = axis.update(pad.axes[0] ?? 0, pad.axes[1] ?? 0)
      if (dir) {
        heldDir = dir
        repeat.press(now())
        dispatch(dir)
      }
      const mag = Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0)
      if (mag < 0.3) {
        heldDir = null
        repeat.release()
      }
      if (heldDir && repeat.tick(now())) dispatch(heldDir)
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('keydown', onKeyLog)
  }
}
