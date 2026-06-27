// Steam Deck Gaming Mode (gamescope) delivers the touchscreen as a MOUSE, so a swipe is a mouse-drag
// and a plain overflow container never scrolls from it. Pan the nearest scroll container on a mouse
// drag. Native touch (pointerType 'touch') scrolls itself, so we only handle 'mouse' to avoid
// double-scrolling on desktop / native-touch setups.
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
    if (e.pointerType !== 'mouse' || e.button !== 0) return
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
    if (!down || e.pointerType !== 'mouse') return
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

  window.addEventListener('pointerdown', onDown, true)
  window.addEventListener('pointermove', onMove, true)
  window.addEventListener('pointerup', onUp, true)
  window.addEventListener('pointercancel', onUp, true)
  window.addEventListener('click', onClick, true)
  return () => {
    window.removeEventListener('pointerdown', onDown, true)
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerup', onUp, true)
    window.removeEventListener('pointercancel', onUp, true)
    window.removeEventListener('click', onClick, true)
  }
}
