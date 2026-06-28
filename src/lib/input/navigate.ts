import {
  nearestInDirection,
  resolveOverride,
  type Direction,
  type Focusable,
  type Overrides
} from './spatial'

export function focusables(scope: ParentNode = document): Focusable[] {
  return Array.from(scope.querySelectorAll<HTMLElement>('[data-focusable]'))
    .filter((e) => e.offsetParent !== null || e.getClientRects().length > 0)
    .filter((e) => !e.closest('[inert]')) // skip elements under an open overlay's inert subtree
    .map((e) => {
      const r = e.getBoundingClientRect()
      return { id: e.id, rect: { x: r.x, y: r.y, width: r.width, height: r.height } }
    })
}

function readOverrides(e: HTMLElement): Overrides {
  const o: Overrides = {}
  for (const d of ['up', 'down', 'left', 'right'] as Direction[]) {
    const sel = e.getAttribute(`data-${d}`)
    if (sel) {
      const t = document.querySelector<HTMLElement>(sel)
      if (t?.id) o[d] = t.id
    }
  }
  return o
}

// First focusable not sealed under an open overlay's [inert] subtree.
function firstFocusable(): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>('[data-focusable]')).find(
      (e) => !e.closest('[inert]')
    ) ?? null
  )
}

export function moveFocus(direction: Direction): boolean {
  const active = document.activeElement as HTMLElement | null
  if (!active || !active.id) {
    const first = firstFocusable()
    first?.focus()
    return !!first
  }
  const override = resolveOverride(readOverrides(active), direction)
  const targetId = override ?? nearestInDirection(active.id, focusables(), direction)
  if (!targetId) return false
  const target = document.getElementById(targetId)
  if (!target) return false
  target.focus()
  if (target.hasAttribute('data-scroll-top')) {
    // Hero controls: reveal the WHOLE hero by snapping the nearest scroll container to the very top,
    // rather than bringing the button into 'nearest' view (which leaves the hero art clipped).
    let p = target.parentElement
    while (p && p !== document.body) {
      const oy = getComputedStyle(p).overflowY
      if (oy === 'auto' || oy === 'scroll') {
        p.scrollTo({ top: 0, behavior: 'smooth' })
        break
      }
      p = p.parentElement
    }
  } else {
    // optional-chain: jsdom (tests) has no scrollIntoView; browsers do
    target.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }
  return true
}

// never-null guard: call from an interval/rAF in the app shell
export function ensureFocus() {
  // Home intentionally starts with nothing focused (so the hero carousel auto-advances); the first
  // D-pad press resolves focus by intent (commands.ts homeIntent), so don't grab it back here.
  if (location.pathname === '/home') return
  const a = document.activeElement
  if (!a || a === document.body) {
    firstFocusable()?.focus()
  }
}
