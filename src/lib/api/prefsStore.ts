import { writable, get } from 'svelte/store'

// The current profile's CR preferences. Server (PATCH /accounts/v1/me/profile) is the source of truth;
// this caches them for the Settings UI + playback defaults. Mirrors profileStore's lazy pattern.
export interface ProfilePrefs {
  audioLanguage: string
  subtitleLanguage: string
  displayLanguage: string
  matureContent: boolean
  closedCaptions: boolean
  audioDescription: boolean
}

export const prefs = writable<ProfilePrefs | null>(null)
let inFlight = false

function bridge() {
  return (globalThis as { window?: { cr?: any } }).window?.cr
}

export async function loadPrefs(force = false): Promise<void> {
  if (inFlight) return
  if (!force && get(prefs)) return
  const cr = bridge()
  if (!cr?.account?.getPrefs) return // browser / not signed in
  inFlight = true
  try {
    const res = await cr.account.getPrefs()
    if (res?.ok) {
      prefs.set(res.data)
      if (res.data.displayLanguage) cr.setLocale?.(res.data.displayLanguage) // metadata locale follows it
    }
  } catch {
    /* keep whatever we had */
  } finally {
    inFlight = false
  }
}

// Optimistic: update the local store immediately, then persist to CR; revert on failure.
export async function savePref(patch: Partial<ProfilePrefs>): Promise<boolean> {
  const cr = bridge()
  if (!cr?.account?.setPrefs) return false
  const prev = get(prefs)
  prefs.update((p) => (p ? { ...p, ...patch } : p))
  if (patch.displayLanguage) cr.setLocale?.(patch.displayLanguage)
  try {
    const res = await cr.account.setPrefs(patch)
    if (!res?.ok) throw new Error(res?.error || 'patch failed')
    return true
  } catch {
    prefs.set(prev) // revert the optimistic change
    return false
  }
}

export function clearPrefs(): void {
  prefs.set(null)
}
