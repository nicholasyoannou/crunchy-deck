import { writable, get } from 'svelte/store'
import type { LangOption } from '$lib/data/languages'

// A global single-select overlay (language pickers, etc.). Rendered once in the layout as a sibling of
// #app-content so opening it can [inert] the page beneath — same pattern as the nav/exit overlays.
export interface PickerState {
  open: boolean
  title: string
  options: LangOption[]
  current: string
  onSelect: (code: string) => void
}

const closed: PickerState = { open: false, title: '', options: [], current: '', onSelect: () => {} }
export const picker = writable<PickerState>(closed)

export function openPicker(cfg: Omit<PickerState, 'open'>): void {
  picker.set({ ...cfg, open: true })
}
export function closePicker(): void {
  picker.set(closed)
}
export function isPickerOpen(): boolean {
  return get(picker).open
}
