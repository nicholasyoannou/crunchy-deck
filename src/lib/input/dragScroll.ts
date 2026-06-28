// Steam Deck Gaming Mode (gamescope, --default-touch-mode 4) feeds the touchscreen through as a
// synthetic pointer whose pointerType is 'mouse' OR — when the device type can't be detected — the
// empty string (per the Pointer Events spec), never 'touch'. So a swipe is a pointer-drag that no
// overflow container scrolls from natively. We pan the nearest scroll container on ANY pointer drag
// (don't gate by pointerType — the empty-string case is exactly what we were missing); paired with
// `touch-action: none` in app.css so the browser never steals the drag as a native scroll/gesture.
function scrollable(el: HTMLElement | null, axis: 'x' | 'y'): HTMLElement | null {
  let p: HTMLElement | null = el
  while (p && p !== document.body) {
    const o = axis === 'y' ? getComputedStyle(p).overflowY : getComputedStyle(p).overflowX
    const canScroll = axis === 'y' ? p.scrollHeight > p.clientHeight + 2 : p.scrollWidth > p.clientWidth + 2
    if ((o === 'auto' || o === 'scroll') && canScroll) return p
    p = p.parentElement
  }
  return null
}

export function startDragScroll(): () => void {
  let down = false
  let dragged = false
  let sx = 0
  let sy = 0
  let lx = 0
  let ly = 0
  let vEl: HTMLElement | null = null
  let hEl: HTMLElement | null = null

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return // primary press only (touch/pen primary is also button 0)
    const t = e.target as HTMLElement
    if (t.closest('[data-player-seek]')) return // the seek bar owns its own drag
    down = true
    dragged = false
    sx = lx = e.clientX
    sy = ly = e.clientY
    vEl = scrollable(t, 'y')
    hEl = scrollable(t, 'x')
  }
  const onMove = (e: PointerEvent) => {
    if (!down) return
    if (!dragged && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return // tap, not a drag
    dragged = true
    if (vEl) vEl.scrollTop -= e.clientY - ly
    if (hEl) hEl.scrollLeft -= e.clientX - lx
    lx = e.clientX
    ly = e.clientY
  }
  const onUp = () => {
    down = false
  }
  // a drag ends in a click on the element it started on — swallow that one so dragging a poster
  // doesn't also open it.
  const onClick = (e: MouseEvent) => {
    if (dragged) {
      e.stopPropagation()
      e.preventDefault()
      dragged = false
    }
  }

  // Belt to the CSS: kill any native drag a pan might start (image/link/selection) so a swipe scrolls.
  const onDragStart = (e: DragEvent) => e.preventDefault()

  window.addEventListener('pointerdown', onDown, true)
  window.addEventListener('pointermove', onMove, true)
  window.addEventListener('pointerup', onUp, true)
  window.addEventListener('pointercancel', onUp, true)
  window.addEventListener('click', onClick, true)
  window.addEventListener('dragstart', onDragStart, true)
  return () => {
    window.removeEventListener('pointerdown', onDown, true)
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerup', onUp, true)
    window.removeEventListener('pointercancel', onUp, true)
    window.removeEventListener('click', onClick, true)
    window.removeEventListener('dragstart', onDragStart, true)
  }
}
