import type { CrHome } from './types'
import { mapHome } from './map'

export type HomeResult = { ok: true; home: CrHome } | { ok: false; error: string }

// Cached so the splash can kick off the fetch DURING the intro animation; /home then
// awaits the same in-flight promise and renders instantly (no "loading feed" screen).
let cache: Promise<HomeResult> | null = null

async function load(): Promise<HomeResult> {
  if (!window.cr) return { ok: false, error: 'Preload bridge unavailable.' }
  const res = await window.cr.api.home('en-US')
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, home: mapHome(res.data.feed, res.data.itemsByRow) }
}

export function prefetchHome(): void {
  if (!cache) cache = load()
}

export function getHome(): Promise<HomeResult> {
  if (!cache) cache = load()
  return cache
}

export function clearHome(): void {
  cache = null
}
