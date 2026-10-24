import { AxisTracker, type NavCommand, type Direction } from './gamepad'
import { resolveButton, feedCapture } from './bindings'
import { RepeatTimer } from './repeat'
import { setInputType } from './inputType'
import { dispatchCommand } from './commands'

function createPadState(id: string) {
  return {
    id,
    axis: new AxisTracker(0.5, 0.3),
    repeat: new RepeatTimer({ initialDelay: 320, startInterval: 120, minInterval: 45, ramp: 1000 }),
    // separate accelerating repeat for the skip buttons: hold to fast-forward / rewind in the player.
    skipRepeat: new RepeatTimer({ initialDelay: 350, startInterval: 280, minInterval: 110, ramp: 1800 }),
    prevButtons: new Map<number, boolean>(),
    heldDir: null as Direction | null,
    heldSkipBtn: null as number | null,
    heldSkipCmd: null as NavCommand | null
  }
}

export function startGamepadPoller() {
  // Edge detection and hold timers belong to a controller, never to the whole frame.
  const states = new Map<number, ReturnType<typeof createPadState>>()
  let raf = 0

  // TEMP input diagnostics — reveals what the Steam Deck emits per physical button so the
  // back/menu mappings can be fixed against real evidence. Remove once mapping is confirmed.
  const onKeyLog = (e: KeyboardEvent) => window.cr?.log(`[key] ${e.key}`)
  window.addEventListener('keydown', onKeyLog)

  const now = () => performance.now()

  const dispatch = (cmd: NavCommand) => dispatchCommand(cmd)

  const loop = () => {
    const pads = navigator.getGamepads?.() ?? []
    const connected = new Set<number>()
    for (const pad of pads) {
      if (!pad || !pad.connected) continue
      connected.add(pad.index)
      let state = states.get(pad.index)
      if (!state || state.id !== pad.id) {
        state = createPadState(pad.id)
        states.set(pad.index, state)
      }
      const { axis, repeat, skipRepeat, prevButtons } = state
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
              state.heldSkipBtn = i // start the hold -> continuous scrub
              state.heldSkipCmd = cmd
              skipRepeat.press(now())
            }
          }
        } else if (pressed && wasPressed && i === state.heldSkipBtn) {
          if (skipRepeat.tick(now()) && state.heldSkipCmd) dispatch(state.heldSkipCmd) // repeat while held
        } else if (!pressed && wasPressed && i === state.heldSkipBtn) {
          state.heldSkipBtn = null // released -> stop scrubbing
          skipRepeat.release()
        }
        prevButtons.set(i, pressed)
      })

      // left stick -> direction with hysteresis + accelerating repeat
      const dir = axis.update(pad.axes[0] ?? 0, pad.axes[1] ?? 0)
      if (dir) {
        state.heldDir = dir
        repeat.press(now())
        dispatch(dir)
      }
      const mag = Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0)
      if (mag < 0.3) {
        state.heldDir = null
        repeat.release()
      }
      if (state.heldDir && repeat.tick(now())) dispatch(state.heldDir)
    }
    // A disconnected pad must not leave held buttons or repeat timers behind.
    for (const index of states.keys()) {
      if (!connected.has(index)) states.delete(index)
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('keydown', onKeyLog)
  }
}
