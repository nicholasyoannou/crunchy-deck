import { writable, get } from 'svelte/store'

// Open-state for the global overlays (left nav + exit confirm), shared between the
// Svelte components that render them and the input dispatcher (commands.ts) so a
// controller's B / LEFT / Start all agree on what's currently showing.
export const navOpen = writable(false)
export const exitOpen = writable(false)

export const openNav = () => navOpen.set(true)
export const closeNav = () => navOpen.set(false)
export const toggleNav = () => navOpen.update((v) => !v)
export const openExit = () => exitOpen.set(true)
export const closeExit = () => exitOpen.set(false)

export const isNavOpen = () => get(navOpen)
export const isExitOpen = () => get(exitOpen)
