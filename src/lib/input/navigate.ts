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

export function moveFocus(direction: Direction): boolean {
  const active = document.activeElement as HTMLElement | null
  if (!active || !active.id) {
    const first = document.querySelector<HTMLElement>('[data-focusable]')
    first?.focus()
    return !!first
  }
  const override = resolveOverride(readOverrides(active), direction)
  const targetId = override ?? nearestInDirection(active.id, focusables(), direction)
  if (!targetId) return false
  const target = document.getElementById(targetId)
  if (!target) return false
  target.focus()
  // optional-chain: jsdom (tests) has no scrollIntoView; browsers do
  target.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  return true
}

// never-null guard: call from an interval/rAF in the app shell
export function ensureFocus() {
  const a = document.activeElement
  if (!a || a === document.body) {
    document.querySelector<HTMLElement>('[data-focusable]')?.focus()
  }
}
