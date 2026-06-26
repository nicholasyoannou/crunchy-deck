import { writable } from 'svelte/store'

export type InputType = 'dpad' | 'mouse' | 'touch'
export const inputType = writable<InputType>('dpad')

export function setInputType(t: InputType) {
  inputType.set(t)
  document.getElementById('root')?.setAttribute('data-input', t)
}
