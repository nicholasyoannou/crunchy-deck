import { buttonToCommand, AxisTracker, type NavCommand, type Direction } from './gamepad'
import { RepeatTimer } from './repeat'
import { setInputType } from './inputType'
import { dispatchCommand } from './commands'

export function startGamepadPoller() {
  const axis = new AxisTracker(0.5, 0.3)
  const repeat = new RepeatTimer({ initialDelay: 320, startInterval: 120, minInterval: 45, ramp: 1000 })
  const prevButtons = new Map<number, boolean>()
  let heldDir: Direction | null = null
  let raf = 0

  const now = () => performance.now()

  const dispatch = (cmd: NavCommand) => dispatchCommand(cmd)

  const loop = () => {
    const pads = navigator.getGamepads?.() ?? []
    for (const pad of pads) {
      if (!pad) continue
      setInputType('dpad')

      // buttons: fire on rising edge
      pad.buttons.forEach((b, i) => {
        const pressed = b.pressed
        if (pressed && !prevButtons.get(i)) {
          const cmd = buttonToCommand(i)
          if (cmd) dispatch(cmd)
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
  return () => cancelAnimationFrame(raf)
}
