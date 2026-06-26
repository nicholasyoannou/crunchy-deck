import type { CrBanner, CrRowDescriptor } from './types'
import { mapBanners } from './map'

export type HomeResult =
  | { ok: true; banners: CrBanner[]; rows: CrRowDescriptor[] }
  | { ok: false; error: string }

// Cached so the splash can kick off the (now lightweight) shell fetch DURING the intro;
// /home then awaits the same promise and renders instantly. Rows load lazily on scroll.
let cache: Promise<HomeResult> | null = null

async function load(): Promise<HomeResult> {
  if (!window.cr) return { ok: false, error: 'Preload bridge unavailable.' }
  const res = await window.cr.api.home('en-US')
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, banners: mapBanners(res.data.feed, res.data.heroCards, res.data.heroItems), rows: res.data.rows }
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
