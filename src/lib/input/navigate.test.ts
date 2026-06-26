import { describe, it, expect, beforeEach } from 'vitest'
import { focusables, moveFocus } from './navigate'

function el(id: string, x: number, y: number) {
  const d = document.createElement('button')
  d.id = id
  d.setAttribute('data-focusable', '')
  d.tabIndex = 0
  const rect = { x, y, width: 100, height: 100, top: y, left: x, right: x + 100, bottom: y + 100, toJSON() {} }
  // jsdom has no layout: stub geometry so focusables() includes it and math works
  d.getBoundingClientRect = () => rect as DOMRect
  d.getClientRects = () => [rect] as unknown as DOMRectList
  document.body.appendChild(d)
  return d
}

describe('navigate (dom)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('collects elements marked data-focusable', () => {
    el('A', 0, 0)
    el('B', 200, 0)
    expect(focusables().map((f) => f.id).sort()).toEqual(['A', 'B'])
  })

  it('moveFocus moves focus to the right neighbor', () => {
    const a = el('A', 0, 0)
    el('B', 200, 0)
    a.focus()
    moveFocus('right')
    expect(document.activeElement?.id).toBe('B')
  })

  it('moveFocus honors a data-override', () => {
    const a = el('A', 0, 0)
    el('B', 200, 0)
    el('Z', 0, 400)
    a.setAttribute('data-down', '#Z')
    a.focus()
    moveFocus('down')
    expect(document.activeElement?.id).toBe('Z')
  })
})
