import { writable } from 'svelte/store'

// The currently-selected Crunchyroll profile, surfaced in the sidebar footer. There's no global
// profile state elsewhere (each screen fetches via IPC), so this caches it. Populated lazily when the
// nav opens; null until then (and in a plain browser where window.cr / the IPC bridge is absent).
export type CurrentProfile = { name: string; avatar?: string }

export const currentProfile = writable<CurrentProfile | null>(null)
let inFlight = false

// CR serves profile avatars from a fixed CDN path (size confirmed against the TV app).
export const avatarUrl = (a?: string) =>
  `https://static.crunchyroll.com/assets/avatar/170x170/${a || '0001-cr-white-orange.png'}`

export async function loadCurrentProfile(): Promise<void> {
  if (inFlight) return
  const cr = (globalThis as { window?: { cr?: any } }).window?.cr
  if (!cr?.auth?.profiles) return // browser / no preload bridge — leave it null, footer falls back
  inFlight = true
  try {
    const res = await cr.auth.profiles()
    if (res?.ok) {
      const list: any[] = res.data ?? []
      const sel = list.find((p) => p.is_selected) ?? list[0]
      if (sel) currentProfile.set({ name: sel.profile_name || sel.username || 'Profile', avatar: sel.avatar })
    }
  } catch {
    /* keep whatever we had */
  } finally {
    inFlight = false
  }
}
