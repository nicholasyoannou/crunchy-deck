# Series loader & card selection redesign

Date: 2026-06-27
Status: Approved (design)
Surfaces: home row cards, series detail page

## Problem

Two navigation rough spots that break the "native, 10-foot" feel the product is aiming for:

1. **Series page loading is clunky.** Clicking a card (`PosterCard` → `goto('/series/:id')`) drops the
   whole screen to a single flat gray pulsing block (`series/[id]/+page.svelte:72-73`,
   `h-screen animate-pulse bg-surface-1`), then **hard-cuts** to the full hero, then the episode grid
   pops in separately on a second round trip. No structure, no transition, and the poster/title we
   already had on the home card is thrown away. Android's Crunchyroll app feels smoother because it shows
   a *structured* skeleton and reveals content progressively.

2. **Card selection looks bad.** The focus treatment reads amateur, worst at the corners. Root causes:
   - The brand ring (`PosterCard.svelte:67`) is an `absolute inset-0` div drawn **inside** the card's
     `overflow-hidden rounded-card` box, so its corners are masked by the rounded clip → uneven thickness.
   - A **second** brand border is layered on top: the global `app.css:21`
     `[data-input='dpad'] [data-focusable]:focus { outline: 3px solid brand; outline-offset: 2px }`.
     Two brand outlines at once.
   - Moving focus horizontally also yanks the page vertically: `navigate.ts:44` calls
     `scrollIntoView({ block:'center', inline:'center' })` — `block:'center'` re-centers the row in the
     page scroll on every left/right press.
   - `Row.svelte:52` uses `overflow-x-auto`, which forces computed `overflow-y:auto`, clipping the
     scaled card + shadow vertically. No scroll padding → edge cards are cut instead of peeking.

## Goals

- Series detail feels like it loads instantly and reveals smoothly, not gray-then-pop.
- Card selection is clean (especially corners), with motion that doesn't jump the page.
- Stay within the locked stack (Electron + SvelteKit + Shaka). Follow existing patterns.

## Non-goals (explicitly out of scope this pass)

- Prefetch-on-focus / hover prefetch of series detail.
- Restoring home scroll position + focus on back-navigation.
- Collapsing the series→episodes round trips (episode load needs the season id from the series response).

## Decisions

- **Selection treatment: "Polished lift + glow" (option A).** Fallback to "Clean frame + reveal" (option C)
  if A doesn't land in practice.
- **Loader: structured skeleton + crossfade + optimistic hero from the clicked card.**
- **Hint passing: a module-level consume-once store**, not `sessionStorage` or SvelteKit page state —
  matches the existing `homeStore` module-cache pattern, no serialization, and it self-clears so a later
  deep-link/refresh correctly falls back to the full skeleton.

## Architecture

The series page today is one fat file mixing load logic, hero, season selector, episode grid, and the
skeleton. Split into focused units:

```
lib/api/seriesHint.ts      consume-once hint store ({ id, title, poster, isPremium })
lib/ui/SeriesHero.svelte   progressive hero: optimistic backdrop -> real bg crossfade, title, play, desc
lib/ui/EpisodeGrid.svelte  episodes + skeleton + episode card (extracted from the page)
lib/ui/SeriesSkeleton.svelte  structured skeleton hero (used when there is no hint)
routes/series/[id]/+page.svelte  orchestrator only (load, phase state, season selection)
```

Each unit answers cleanly: what it does, what props it takes, what it depends on.

### `lib/api/seriesHint.ts`

```ts
export type SeriesHint = { id: string; title: string; poster: string; isPremium: boolean }
let pending: SeriesHint | null = null
export function setHint(h: SeriesHint): void { pending = h }
// consume-once: returns the hint only if it matches this id, then clears it
export function takeHint(id: string): SeriesHint | null {
  const h = pending && pending.id === id ? pending : null
  pending = null
  return h
}
```

`PosterCard` calls `setHint(...)` in the same click handler that calls `goto('/series/:id')`. The series
page calls `takeHint(id)` synchronously in `onMount`, before any await. (`Card.svelte` is demo-only
(`routes/demo`) and does not navigate, so it gets no hint wiring — see treatment note below.)

## Data flow / progressive reveal

`+page.svelte` replaces the `loading → hard-cut → ready` branch with one progressive paint. State the hero
and grid render from, by phase:

| Phase | Hero | Episode grid |
|-------|------|--------------|
| mount, hint present | exact title + blurred/scaled poster backdrop; play + desc are shimmer | shimmer grid |
| mount, no hint | `SeriesSkeleton` (structured shimmer hero) | shimmer grid |
| series resolves | real landscape `info.background` crossfades in over the backdrop; description fills; play label resolves (`Play` / `Continue · S_E_`); season chips appear | shimmer grid |
| episodes resolve | (unchanged) | grid crossfades in |

Crossfade mechanism: CSS opacity transitions. The real hero `<img>` starts `opacity:0` and transitions to
`1` on its `onload`, sitting above the blurred-poster backdrop layer. The episode grid container starts
`opacity:0` and transitions to `1` when episodes are set. No hard `{#if}` swap between a gray block and the
content.

Backdrop caveat: the card hint carries the **portrait** poster, while the hero uses a **landscape**
background — different images. The optimistic backdrop is therefore the portrait poster, blurred and
`object-cover` scaled, purely to provide instant color/ambiance behind the **exact** title. The real
landscape bg crossfades over it once loaded, so the approximation is never the final state.

## Selection treatment A — details

Applied to `PosterCard.svelte` (the real card). `Card.svelte` is demo-only and gets the same `box-shadow`
ring for visual parity but no hint wiring (it does not navigate).

- Ring + lift via `box-shadow` on the card element itself (outside the `overflow-hidden`):
  `select:` → `box-shadow: 0 0 0 3px theme(brand), 0 14px 34px rgba(0,0,0,.65)`.
- Delete the inner `absolute inset-0 ... ring` div (`PosterCard.svelte:67`) — the clipped-corner source.
- `transform: translateY(-7px) scale(1.05)`; `transform-origin: center bottom`; `transition` ~170ms ease.
- Non-focused siblings in the row dim slightly (`opacity:.82`) — handled at the row level so only the
  active row's unfocused cards dim.

Supporting fixes (shared by all treatments, these are the actual "horrendous" causes):

- `app.css`: scope the global dpad `outline` to non-card focusables (season chips, play button, etc.) so
  cards do not get a second brand outline on top of their `box-shadow` ring. Cards opt out via a marker
  class/attribute, or the selector is narrowed to exclude `[data-card]`.
- `Row.svelte:52`: add vertical padding (≈`py-8`) so the lifted card + glow have room before the row's
  computed `overflow-y` clips them; add horizontal scroll padding (`scroll-px`) so the first/last cards
  peek at the row edges instead of being cut.
- `navigate.ts:44`: change `block:'center'` → `block:'nearest'` (keep `inline:'center'`) so horizontal
  focus moves stop scrolling the page vertically.

## Skeleton quality

Replace `animate-pulse` (opacity blink — reads cheap) with a **shimmer sweep**: a `.shimmer` utility
(CSS keyframe translating a light gradient across a `bg-surface-2` base). Apply to all skeleton surfaces
(hero block, title bar, play pill, desc lines, season chips, episode tiles, `SkeletonCard`). This moving
sweep is the specific detail that makes Android's loader read as native vs the current blink.

## Testing

- `seriesHint.test.ts` — `setHint`/`takeHint` consume-once: returns the hint once for a matching id, then
  `null`; returns `null` for a non-matching id and still clears.
- `navigate.ts` — the `block` param change is covered by the existing jsdom optional-chain guard on
  `scrollIntoView?.(...)`; no behavior break in tests.
- Svelte UI components are not heavily unit-tested in this repo (consistent with current practice); verify
  the loader/selection visually in the running app.

## File change summary

New:
- `src/lib/api/seriesHint.ts`
- `src/lib/api/seriesHint.test.ts`
- `src/lib/ui/SeriesHero.svelte`
- `src/lib/ui/EpisodeGrid.svelte`
- `src/lib/ui/SeriesSkeleton.svelte`

Edited:
- `src/routes/series/[id]/+page.svelte` — orchestrator; progressive reveal; consume hint.
- `src/lib/ui/PosterCard.svelte` — treatment A; set hint on click; remove inner ring div.
- `src/lib/ui/Card.svelte` — treatment A box-shadow ring only (demo-only; no hint, no navigation).
- `src/lib/ui/Row.svelte` — vertical padding + scroll padding; dim unfocused siblings.
- `src/lib/ui/SkeletonCard.svelte` — shimmer instead of pulse.
- `src/lib/input/navigate.ts` — `block:'nearest'`.
- `src/app.css` — `.shimmer` keyframe; scope the global dpad outline off cards.
