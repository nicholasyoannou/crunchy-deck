import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startGamepadPoller } from './poller'
import { dispatchCommand } from './commands'

vi.mock('./commands', () => ({ dispatchCommand: vi.fn() }))

function pad(index: number, id = `controller-${index}`): Gamepad {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
  return { index, id, connected: true, axes: [0, 0], buttons } as unknown as Gamepad
}

function press(p: Gamepad, button: number, pressed: boolean) {
  Object.assign(p.buttons[button], { pressed, value: Number(pressed) })
}

function stickX(p: Gamepad, x: number) {
  (p.axes as number[])[0] = x
}

const calls = () => vi.mocked(dispatchCommand).mock.calls.length

let frame: FrameRequestCallback
let pads: (Gamepad | null)[]
let stop: () => void
let time: number

// Advance n animation frames of 16ms each (60 frames ≈ a one-second hold).
function tick(n = 1) {
  for (let i = 0; i < n; i++) {
    time += 16
    frame(time)
  }
}

beforeEach(() => {
  time = 0
  pads = [pad(0), pad(1)]
  vi.spyOn(performance, 'now').mockImplementation(() => time)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frame = cb
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => pads })
  vi.mocked(dispatchCommand).mockClear()
  stop = startGamepadPoller()
})

afterEach(() => {
  stop()
  history.replaceState({}, '', '/')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('per-controller input state', () => {
  for (const index of [0, 1]) {
    it(`fires one command per press from slot ${index} with an idle peer`, () => {
      const p = pads[index]!
      press(p, 0, true) // hold A
      tick(60)
      expect(dispatchCommand).toHaveBeenCalledTimes(1)
      press(p, 0, false)
      tick()
      press(p, 0, true)
      tick(60)
      expect(dispatchCommand).toHaveBeenCalledTimes(2)
    })
  }
  it('preserves independent edges when both controllers press the same button', () => {
    press(pads[0]!, 0, true)
    tick()
    press(pads[1]!, 0, true)
    tick(10)
    expect(dispatchCommand).toHaveBeenCalledTimes(2)
  })
  it('does not restart stick presses or lose repeat to an idle peer', () => {
    stickX(pads[0]!, 0.8)
    tick(10) // still inside the repeat's initial delay
    expect(dispatchCommand).toHaveBeenCalledTimes(1)
    tick(20)
    expect(calls()).toBeGreaterThan(1)
    stickX(pads[0]!, 0)
    tick()
    const count = calls()
    tick(60)
    expect(dispatchCommand).toHaveBeenCalledTimes(count)
  })
  it('clears state when a controller disconnects and its slot is reused', () => {
    press(pads[0]!, 0, true)
    tick()
    pads[0] = null
    tick()
    pads[0] = pad(0)
    press(pads[0], 0, true)
    tick(10)
    expect(dispatchCommand).toHaveBeenCalledTimes(2)
  })
  it('clears state when a different device replaces a slot between frames', () => {
    press(pads[0]!, 0, true)
    tick()
    pads[0] = pad(0, 'replacement')
    press(pads[0], 0, true)
    tick()
    expect(dispatchCommand).toHaveBeenCalledTimes(2)
  })
  it('retains single-controller behavior with sparse gamepad slots', () => {
    pads = [null, pad(1)]
    press(pads[1]!, 0, true)
    tick(60)
    expect(dispatchCommand).toHaveBeenCalledTimes(1)
  })
  it('keeps skip hold repeat independent of an idle controller and stops on release', () => {
    history.replaceState({}, '', '/watch/test') // skip-hold only repeats in the player
    press(pads[0]!, 7, true) // R2 = default skip forward
    tick(10)
    expect(dispatchCommand).toHaveBeenCalledTimes(1)
    expect(dispatchCommand).toHaveBeenCalledWith('next')
    tick(30)
    expect(calls()).toBeGreaterThan(1)
    press(pads[0]!, 7, false)
    tick()
    const count = calls()
    tick(60)
    expect(dispatchCommand).toHaveBeenCalledTimes(count)
  })
  it('does not repeat navigation buttons when held outside playback', () => {
    press(pads[1]!, 7, true)
    tick(120)
    expect(dispatchCommand).toHaveBeenCalledTimes(1)
  })
  it('stops the animation loop on cleanup', () => {
    stop()
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
  })
})
