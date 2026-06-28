// The Steam Deck's Steam (Guide) button is NOT exposed to the Gamepad API — Steam reserves it (the
// Deck's own input log only ever shows button indices 0-15, never a guide button). While it's HELD,
// Steam runs its "Guide Button Chord Layout", which remaps the other buttons to Steam shortcuts and —
// per the Deck's input log ([key] Meta / [key] Alt) — emits keyboard modifiers. So we infer "a Steam
// chord is in progress" from: a held Meta/Super or Alt key, or the app having lost focus to Steam's
// overlay. Used to suppress the player's L1/R1 skip so a Steam+shoulder chord doesn't also fast-forward.
let metaHeld = false
let altHeld = false

export function isSteamChordActive(): boolean {
  return metaHeld || altHeld || !document.hasFocus()
}

export function startSteamChordTracker(): () => void {
  // Reconcile against the AUTHORITATIVE modifier state on every key event (getModifierState) rather
  // than hand-toggling on keydown/keyup. A swallowed keyup (focus lost mid-chord, the OS consuming a
  // chord, Alt+Tab) would otherwise wedge a flag stuck true and permanently disable skip; here the
  // next key event self-heals it to the truth.
  const sync = (e: KeyboardEvent) => {
    metaHeld = e.getModifierState('Meta') || e.getModifierState('OS')
    altHeld = e.getModifierState('Alt')
  }
  const clear = () => {
    metaHeld = false
    altHeld = false
  }
  window.addEventListener('keydown', sync, true)
  window.addEventListener('keyup', sync, true)
  window.addEventListener('blur', clear) // window-level focus loss: drop everything
  return () => {
    window.removeEventListener('keydown', sync, true)
    window.removeEventListener('keyup', sync, true)
    window.removeEventListener('blur', clear)
  }
}
