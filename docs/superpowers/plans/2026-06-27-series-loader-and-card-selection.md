# Series Loader & Card Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the series detail page load with a structured, progressively-revealed skeleton (optimistic hero painted from the clicked card) and give row cards a clean "lift + glow" selection treatment, fixing the clipped corners, double focus outline, and vertical page-jump on horizontal nav.

**Architecture:** Card click stashes a hint (`{id,title,poster,isPremium}`) in a consume-once module store; the series page reads it synchronously on mount and renders `SeriesHero` (optimistic blurred-poster backdrop + exact title → real landscape bg crossfades in) and `EpisodeGrid` (shimmer skeleton → crossfade to grid). Selection is a `box-shadow` ring drawn *outside* the card's `overflow-hidden` box; elements that own their focus ring opt out of the global d-pad outline via `data-focus-self`. Skeletons use a moving shimmer sweep instead of opacity blink.

**Tech Stack:** SvelteKit (Svelte 5 runes), Tailwind CSS v3, Vitest + jsdom, Electron renderer.

**Note on spec deviation:** The spec listed a separate `SeriesSkeleton.svelte`. To stay DRY, the no-hint structured skeleton is folded into `SeriesHero`'s fallback branch (one hero component owns all three load states). No separate skeleton component is created. The `data-focus-self` opt-out is applied to *all* elements that render their own select ring (poster cards, demo card, hero play button, season chips, episode tiles), which fully removes the double-outline everywhere rather than only on poster cards.

**Conventions:**
- Package manager is `pnpm`. Run a single test file with `pnpm vitest run <path>`. Run all tests with `pnpm test`. Type-check Svelte with `pnpm check`.
- Tailwind arbitrary values use underscores for spaces: `shadow-[0_0_0_3px_#F47521,...]` renders `box-shadow: 0 0 0 3px #F47521, ...`.
- The `select:` Tailwind variant = `:hover, :focus-visible, :focus, :active` (see `tailwind.config.ts`).

---

## File Structure

New:
- `src/lib/api/seriesHint.ts` — consume-once hint store.
- `src/lib/api/seriesHint.test.ts` — unit test for the store.
- `src/lib/ui/SeriesHero.svelte` — progressive hero (optimistic backdrop → real bg crossfade; owns the no-hint skeleton).
- `src/lib/ui/EpisodeGrid.svelte` — episode grid + shimmer skeleton + crossfade (extracted from the page).

Modified:
- `src/app.css` — `.shimmer` keyframe utility; scope the global d-pad outline off `[data-focus-self]`.
- `src/lib/input/navigate.ts` — `scrollIntoView` `block:'center'` → `block:'nearest'`.
- `src/lib/ui/PosterCard.svelte` — treatment A; set hint on click; remove inner ring div; `data-focus-self`.
- `src/lib/ui/Card.svelte` — treatment A box-shadow ring; remove inner ring div; `data-focus-self` (demo-only, no hint/nav).
- `src/lib/ui/Row.svelte` — vertical + horizontal scroll padding; dim unfocused siblings on focus-within.
- `src/lib/ui/SkeletonCard.svelte` — shimmer instead of `animate-pulse`.
- `src/lib/api/types.ts` — add `CrUpNext` type.
- `src/routes/series/[id]/+page.svelte` — orchestrator only; render `SeriesHero` + `EpisodeGrid`.
- `src/routes/home/+page.svelte` — swap the inline skeleton `animate-pulse` blocks for `shimmer`.

---

# Part A — Card selection & navigation feel

### Task 1: Shimmer utility + scope the global d-pad outline

**Files:**
- Modify: `src/app.css`

- [ ] **Step 1: Add the `.shimmer` keyframe and scope the outline**

Replace the focus-outline block and append the shimmer utility. The current file (`src/app.css:20-24`) reads:

```css
/* always-obvious focus for controller use */
[data-input='dpad'] [data-focusable]:focus {
  outline: 3px solid theme('colors.brand');
  outline-offset: 2px;
}
```

Change it to exclude elements that render their own focus ring, and add the shimmer utility immediately after:

```css
/* always-obvious focus for controller use — skipped for elements that own their ring */
[data-input='dpad'] [data-focusable]:focus:not([data-focus-self]) {
  outline: 3px solid theme('colors.brand');
  outline-offset: 2px;
}

/* skeleton shimmer sweep (reads more native than an opacity blink) */
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
.shimmer {
  position: relative;
  overflow: hidden;
  background-color: theme('colors.surface.2');
}
.shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
  animation: shimmer 1.4s infinite;
}
```

- [ ] **Step 2: Verify the web build compiles the CSS**

Run: `pnpm build:web`
Expected: build completes with no PostCSS/Tailwind error (the `theme()` calls resolve).

- [ ] **Step 3: Commit**

```bash
git add src/app.css
git commit -m "feat(ui): shimmer skeleton utility + scope d-pad outline off data-focus-self"
```

---

### Task 2: Stop horizontal nav from jumping the page vertically

**Files:**
- Modify: `src/lib/input/navigate.ts:44`
- Test: `src/lib/input/navigate.test.ts` (existing — must stay green)

- [ ] **Step 1: Change the scroll alignment**

In `src/lib/input/navigate.ts`, line 44 currently reads:

```ts
    target.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' })
```

Change `block` to `nearest` so a left/right move only scrolls the row horizontally and never re-centers the page vertically:

```ts
    target.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'smooth' })
```

- [ ] **Step 2: Run the navigation tests**

Run: `pnpm vitest run src/lib/input/navigate.test.ts`
Expected: PASS (3 tests). jsdom buttons have no `scrollIntoView`, so the optional-chain guard means the param change is inert under test.

- [ ] **Step 3: Commit**

```bash
git add src/lib/input/navigate.ts
git commit -m "fix(nav): use block:'nearest' so horizontal focus moves don't jump the page"
```

---

### Task 3: Selection treatment A (lift + glow) + row breathing room

**Files:**
- Modify: `src/lib/ui/PosterCard.svelte:25-31` and `:67`
- Modify: `src/lib/ui/Card.svelte`
- Modify: `src/lib/ui/Row.svelte:50-63`

- [ ] **Step 1: PosterCard — box-shadow ring, lift, remove inner ring div**

In `src/lib/ui/PosterCard.svelte`, change the button's class list (currently `:25-31`) to drop the clip-prone `select:shadow-2xl` and add the outside-the-box ring + lift, plus the `data-focus-self` opt-out. Replace the opening `<button ...>` tag:

```svelte
<button
  id={uid}
  data-focusable
  data-focus-self
  title={item.title}
  onclick={() => goto(`/series/${item.id}`)}
  class={`group relative shrink-0 origin-bottom overflow-hidden rounded-card bg-surface-2 outline-none transition-[transform,box-shadow] duration-150 ease-out select:-translate-y-[7px] select:scale-105 select:shadow-[0_0_0_3px_#F47521,0_14px_34px_rgba(0,0,0,0.65)] ${size}`}
>
```

Then delete the inner ring div (the clipped-corner source) at `src/lib/ui/PosterCard.svelte:67`:

```svelte
  <div class="pointer-events-none absolute inset-0 rounded-card ring-0 ring-brand transition-all group-select:ring-4"></div>
```

(The play affordance, badges, and gradient overlay above it stay exactly as-is. `onclick` gets the hint added in Task 8 — leave it as a plain `goto` for now.)

- [ ] **Step 2: Card (demo) — same ring, remove inner ring div**

`src/lib/ui/Card.svelte` is used only by `routes/demo`. Replace its whole body so it gets the same treatment for visual parity (no navigation, no hint):

```svelte
<script lang="ts">
  let { id, title }: { id: string; title: string } = $props()
</script>

<button
  {id}
  data-focusable
  data-focus-self
  class="group relative h-[290px] w-[195px] shrink-0 origin-bottom overflow-hidden rounded-card bg-surface-2
         outline-none transition-[transform,box-shadow] duration-150 ease-out
         select:-translate-y-[7px] select:scale-105 select:shadow-[0_0_0_3px_#F47521,0_14px_34px_rgba(0,0,0,0.65)]"
>
  <div class="flex h-full w-full items-end bg-gradient-to-t from-black/70 to-surface-3 p-3">
    <span class="text-left text-sm font-bold leading-tight">{title}</span>
  </div>
</button>
```

- [ ] **Step 3: Row — vertical room for the lift + glow, edge peek, dim unfocused siblings**

In `src/lib/ui/Row.svelte`, replace the `<section>...</section>` block (`:50-63`) so the scroller has vertical padding (the lifted card + glow would otherwise be clipped by the row's computed `overflow-y`), horizontal scroll padding so the first/last cards peek instead of clip, and a scoped style that dims non-focused cards only while the row has focus:

```svelte
<section bind:this={section} class="mb-8" class:hidden={items !== null && items.length === 0}>
  <h2 class="mb-3 text-lg font-bold text-white/80">{row.title}</h2>
  <div class="flex gap-4 overflow-x-auto px-1 py-8 [scroll-padding-inline:1.5rem]">
    {#if items === null}
      {#each Array(8) as _i}
        <SkeletonCard />
      {/each}
    {:else}
      {#each items as item, i}
        <PosterCard uid={`r${index}i${i}`} {item} />
      {/each}
    {/if}
  </div>
</section>

<style>
  section:focus-within :global([data-focus-self]:not(:focus):not(:hover)) {
    opacity: 0.82;
    transition: opacity 0.15s ease;
  }
</style>
```

- [ ] **Step 4: Type-check**

Run: `pnpm check`
Expected: no new errors in `PosterCard.svelte`, `Card.svelte`, or `Row.svelte`.

- [ ] **Step 5: Visual verify**

Run: `pnpm dev`, open home, move focus along a row with arrow keys.
Expected: focused card lifts with a clean unbroken brand ring (no chipped corners, no second outline); neighbors dim slightly; first/last cards peek at the row edges; moving left/right does NOT scroll the page up/down.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ui/PosterCard.svelte src/lib/ui/Card.svelte src/lib/ui/Row.svelte
git commit -m "feat(ui): lift+glow card selection; fix clipped corners, double outline, edge clip"
```

---

# Part B — Series detail loader

### Task 4: Add the `CrUpNext` type

**Files:**
- Modify: `src/lib/api/types.ts`

- [ ] **Step 1: Add the exported type**

Append to `src/lib/api/types.ts` (the `upNext` shape currently lives inline in the series page):

```ts
export type CrUpNext = {
  id: string
  seasonNumber: number
  episodeNumber: number
  playhead: number // resume point, seconds
  fullyWatched: boolean
} | null
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/types.ts
git commit -m "feat(types): add CrUpNext for the series up-next resume target"
```

---

### Task 5: Consume-once series hint store (TDD)

**Files:**
- Create: `src/lib/api/seriesHint.ts`
- Test: `src/lib/api/seriesHint.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/seriesHint.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { setHint, takeHint } from './seriesHint'

describe('seriesHint', () => {
  it('returns the hint once for a matching id, then clears it', () => {
    setHint({ id: 'S1', title: 'Naruto', poster: 'tall.jpg', isPremium: false })
    expect(takeHint('S1')).toMatchObject({ id: 'S1', title: 'Naruto', poster: 'tall.jpg', isPremium: false })
    expect(takeHint('S1')).toBeNull()
  })

  it('returns null for a non-matching id and still clears the pending hint', () => {
    setHint({ id: 'S1', title: 'Naruto', poster: 'tall.jpg', isPremium: false })
    expect(takeHint('S2')).toBeNull()
    expect(takeHint('S1')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/api/seriesHint.test.ts`
Expected: FAIL — cannot resolve `./seriesHint` (module does not exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/api/seriesHint.ts`:

```ts
export type SeriesHint = {
  id: string
  title: string
  poster: string
  isPremium: boolean
}

let pending: SeriesHint | null = null

export function setHint(hint: SeriesHint): void {
  pending = hint
}

// Consume-once: returns the hint only if it matches `id`, then clears the slot
// either way so a later deep-link/refresh falls back to the full skeleton.
export function takeHint(id: string): SeriesHint | null {
  const hit = pending && pending.id === id ? pending : null
  pending = null
  return hit
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/api/seriesHint.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/seriesHint.ts src/lib/api/seriesHint.test.ts
git commit -m "feat(api): consume-once series hint store for optimistic hero paint"
```

---

### Task 6: `SeriesHero` — progressive hero

**Files:**
- Create: `src/lib/ui/SeriesHero.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/ui/SeriesHero.svelte`. It renders three load states: no data → shimmer; hint only → blurred poster backdrop + exact title + skeleton desc/play; info ready → real landscape bg crossfades in, description and play button resolve.

```svelte
<script lang="ts">
  import type { CrSeriesInfo, CrUpNext } from '$lib/api/types'
  import type { SeriesHint } from '$lib/api/seriesHint'

  let {
    hint,
    info,
    upNext,
    onplay
  }: {
    hint: SeriesHint | null
    info: CrSeriesInfo | null
    upNext: CrUpNext
    onplay: () => void
  } = $props()

  let bgLoaded = $state(false)
  const title = $derived(info?.title ?? hint?.title ?? '')
  const playLabel = $derived(
    upNext && !upNext.fullyWatched
      ? `Continue · S${upNext.seasonNumber} E${upNext.episodeNumber}`
      : 'Play'
  )
</script>

<div class="relative h-[52vh] overflow-hidden">
  {#if hint && !bgLoaded}
    <img src={hint.poster} alt="" class="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
  {:else if !info}
    <div class="absolute inset-0 shimmer"></div>
  {/if}
  {#if info}
    <img
      src={info.background}
      alt={info.title}
      onload={() => (bgLoaded = true)}
      onerror={() => (bgLoaded = true)}
      class="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
      style="opacity:{bgLoaded ? 1 : 0}"
    />
  {/if}

  <div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface via-surface/60 to-transparent"></div>
  <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent"></div>

  <div class="absolute bottom-8 left-10 max-w-[55%]">
    {#if title}
      <h1 class="mb-3 text-4xl font-black drop-shadow-lg">{title}</h1>
    {:else}
      <div class="shimmer mb-3 h-10 w-80 rounded"></div>
    {/if}

    {#if info}
      <p class="mb-5 line-clamp-3 text-sm text-white/75 drop-shadow">{info.description}</p>
    {:else}
      <div class="shimmer mb-2 h-3.5 w-[28rem] max-w-full rounded"></div>
      <div class="shimmer mb-2 h-3.5 w-[24rem] max-w-full rounded"></div>
      <div class="shimmer mb-5 h-3.5 w-[18rem] max-w-full rounded"></div>
    {/if}

    {#if info}
      <button
        id="hero-play"
        data-focusable
        data-focus-self
        onclick={onplay}
        class="inline-flex items-center gap-2 rounded-lg bg-brand px-7 py-3 font-bold text-black outline-none transition select:ring-4 select:ring-white/40"
      >
        <span class="text-lg">▶</span>
        {playLabel}
      </button>
    {:else}
      <div class="shimmer h-12 w-44 rounded-lg"></div>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Type-check**

Run: `pnpm check`
Expected: no errors in `SeriesHero.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ui/SeriesHero.svelte
git commit -m "feat(ui): SeriesHero progressive hero with optimistic backdrop + bg crossfade"
```

---

### Task 7: `EpisodeGrid` — extracted grid + shimmer + crossfade

**Files:**
- Create: `src/lib/ui/EpisodeGrid.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/ui/EpisodeGrid.svelte`. The episode-card markup is copied verbatim from the current page (`src/routes/series/[id]/+page.svelte:121-156`); only the skeleton uses `shimmer`, the button gains `data-focus-self`, and the grid fades in.

```svelte
<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { CrEpisode } from '$lib/api/types'

  let {
    episodes,
    loading,
    onplay
  }: {
    episodes: CrEpisode[]
    loading: boolean
    onplay: (epId: string, t?: number) => void
  } = $props()
</script>

{#if loading}
  <div class="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4">
    {#each Array(8) as _e}
      <div class="shimmer aspect-video rounded-card"></div>
    {/each}
  </div>
{:else}
  <div in:fade={{ duration: 200 }} class="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4">
    {#each episodes as ep, i}
      <button
        id={`ep-${i}`}
        data-focusable
        data-focus-self
        onclick={() => onplay(ep.id, ep.watched ? 0 : (ep.playhead ?? 0))}
        class="group text-left outline-none"
      >
        <div class="relative aspect-video overflow-hidden rounded-card bg-surface-2 transition group-select:ring-2 group-select:ring-brand">
          <img
            src={ep.background}
            alt={ep.title}
            loading="lazy"
            class="h-full w-full object-cover transition-transform duration-150 group-select:scale-105 {ep.watched ? 'opacity-50' : ''}"
          />
          <div class="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition-opacity group-select:opacity-100">
            <div class="grid h-12 w-12 place-items-center rounded-full bg-black/60 pl-0.5 text-xl">▶</div>
          </div>
          {#if ep.premium}
            <span class="absolute left-1.5 top-1.5 text-brand drop-shadow" title="Premium">◆</span>
          {/if}
          {#if ep.watched}
            <span class="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-[11px] font-black text-black" title="Watched">✓</span>
          {:else if ep.duration}
            <span class="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold">{ep.duration}m</span>
          {/if}
          {#if ep.progress && ep.progress > 0 && !ep.watched}
            <div class="absolute inset-x-0 bottom-0 h-1 bg-white/25">
              <div class="h-full bg-brand" style="width:{ep.progress}%"></div>
            </div>
          {/if}
        </div>
        <div class="mt-2 text-xs font-bold text-white/50">Episode {ep.episodeNumber}</div>
        <div class="line-clamp-1 text-sm font-bold {ep.watched ? 'text-white/55' : ''}">{ep.title}</div>
        <div class="line-clamp-2 text-xs text-white/45">{ep.description}</div>
      </button>
    {/each}
  </div>
{/if}
```

- [ ] **Step 2: Type-check**

Run: `pnpm check`
Expected: no errors in `EpisodeGrid.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ui/EpisodeGrid.svelte
git commit -m "feat(ui): EpisodeGrid with shimmer skeleton and fade-in"
```

---

### Task 8: Rewrite the series page as an orchestrator + wire the hint on card click

**Files:**
- Modify: `src/routes/series/[id]/+page.svelte` (full rewrite)
- Modify: `src/lib/ui/PosterCard.svelte` (add `setHint` to the click handler)

- [ ] **Step 1: Rewrite the series page**

Replace the entire contents of `src/routes/series/[id]/+page.svelte` with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { mapSeriesInfo, mapSeasons, mapEpisodes } from '$lib/api/map'
  import { authGuard } from '$lib/api/guard'
  import { takeHint, type SeriesHint } from '$lib/api/seriesHint'
  import type { CrSeriesInfo, CrSeason, CrEpisode, CrUpNext } from '$lib/api/types'
  import SeriesHero from '$lib/ui/SeriesHero.svelte'
  import EpisodeGrid from '$lib/ui/EpisodeGrid.svelte'

  const startId = $page.params.id ?? ''
  let hint: SeriesHint | null = $state(takeHint(startId))
  let phase: 'loading' | 'ready' | 'error' = $state('loading')
  let info: CrSeriesInfo | null = $state(null)
  let seasons: CrSeason[] = $state([])
  let selected = $state(0)
  let episodes: CrEpisode[] = $state([])
  let epsLoading = $state(true)
  let upNext: CrUpNext = $state(null)
  let error = $state('')

  async function loadEps(seasonId: string) {
    epsLoading = true
    episodes = []
    const res = await window.cr.api.episodes(seasonId)
    episodes = res.ok ? mapEpisodes(res.data) : []
    epsLoading = false
  }

  async function selectSeason(i: number) {
    if (i === selected && episodes.length) return
    selected = i
    if (seasons[i]) await loadEps(seasons[i].id)
  }

  function play(epId: string, t = 0) {
    goto(`/watch/${epId}${t > 0 ? `?t=${Math.floor(t)}` : ''}`)
  }
  function playMain() {
    if (upNext && !upNext.fullyWatched) play(upNext.id, upNext.playhead)
    else if (episodes[0]) play(episodes[0].id)
  }

  onMount(async () => {
    if (!window.cr) {
      phase = 'error'
      error = 'Preload bridge unavailable.'
      return
    }
    const res = await window.cr.api.series(startId)
    if (!res.ok) {
      if (authGuard(res)) return
      phase = 'error'
      error = res.error
      return
    }
    info = mapSeriesInfo(res.data.series)
    seasons = mapSeasons(res.data.seasons)
    upNext = res.data.upNext
    phase = 'ready'
    if (seasons[0]) await loadEps(seasons[0].id)
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-focusable]')?.focus())
  })
</script>

{#if phase === 'error'}
  <div class="grid h-screen place-items-center text-center">
    <div>
      <p class="mb-2 text-xl font-bold text-brand">Couldn't load this title</p>
      <p class="max-w-md text-sm text-white/50">{error}</p>
    </div>
  </div>
{:else}
  <div class="h-screen overflow-y-auto">
    <SeriesHero {hint} {info} {upNext} onplay={playMain} />

    <div class="px-10 pb-16">
      {#if info && seasons.length > 1}
        <div class="mb-6 flex flex-wrap gap-2">
          {#each seasons as season, i}
            <button
              data-focusable
              data-focus-self
              onclick={() => selectSeason(i)}
              class="rounded-full px-4 py-1.5 text-sm font-semibold outline-none transition select:ring-2 select:ring-brand {i ===
              selected
                ? 'bg-brand text-black'
                : 'bg-surface-2 text-white/80'}"
            >{season.title}</button>
          {/each}
        </div>
      {/if}

      <EpisodeGrid {episodes} loading={epsLoading} onplay={play} />
    </div>
  </div>
{/if}
```

- [ ] **Step 2: Set the hint on card click in PosterCard**

In `src/lib/ui/PosterCard.svelte`, add the `setHint` import to the `<script>` block:

```svelte
  import { setHint } from '$lib/api/seriesHint'
```

Then change the button `onclick` (set in Task 3) to stash the hint before navigating:

```svelte
  onclick={() => {
    setHint({ id: item.id, title: item.title, poster: item.poster ?? item.background, isPremium: !!item.isPremium })
    goto(`/series/${item.id}`)
  }}
```

- [ ] **Step 3: Type-check**

Run: `pnpm check`
Expected: no errors. Confirms `CrUpNext`, `SeriesHint`, and both new components are wired with matching prop types.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: PASS (existing map/navigate/spatial tests + the new `seriesHint` test).

- [ ] **Step 5: Visual verify the loader**

Run: `pnpm dev`, open home, click a card.
Expected: the series page shows the exact title immediately over a blurred poster backdrop with shimmer desc/play (no flat gray block); the real landscape hero crossfades in; the episode grid shimmers then fades to real episodes. Click a card, then press Back — home returns immediately (it is cached).

- [ ] **Step 6: Commit**

```bash
git add src/routes/series/[id]/+page.svelte src/lib/ui/PosterCard.svelte
git commit -m "feat(series): progressive loader via SeriesHero + EpisodeGrid; optimistic hero from card hint"
```

---

### Task 9: Shimmer the remaining skeletons (consistency)

**Files:**
- Modify: `src/lib/ui/SkeletonCard.svelte`
- Modify: `src/routes/home/+page.svelte:47-61`

- [ ] **Step 1: SkeletonCard — shimmer instead of pulse**

Replace the body of `src/lib/ui/SkeletonCard.svelte`:

```svelte
<script lang="ts">
  let { episode = false }: { episode?: boolean } = $props()
</script>

<div
  class="shimmer shrink-0 rounded-card {episode ? 'h-[150px] w-[266px]' : 'h-[290px] w-[195px]'}"
></div>
```

- [ ] **Step 2: Home loading shell — shimmer the inline blocks**

In `src/routes/home/+page.svelte`, the loading branch (`:47-61`) uses `animate-pulse`. Replace that branch with the shimmer equivalent:

```svelte
{:else if phase === 'loading'}
  <!-- shell skeleton (brief — the shell is prefetched during the intro) -->
  <div class="h-screen overflow-hidden p-10">
    <div class="shimmer mb-8 h-[42vh] rounded-card"></div>
    {#each Array(2) as _row}
      <section class="mb-8">
        <div class="shimmer mb-3 h-5 w-48 rounded"></div>
        <div class="flex gap-4 overflow-hidden">
          {#each Array(8) as _card}
            <SkeletonCard />
          {/each}
        </div>
      </section>
    {/each}
  </div>
```

- [ ] **Step 3: Type-check and visual verify**

Run: `pnpm check`
Expected: no errors.
Then `pnpm dev`: the home loading shell and row skeletons show a moving shimmer sweep, not an opacity blink.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ui/SkeletonCard.svelte src/routes/home/+page.svelte
git commit -m "feat(ui): shimmer the home shell + card skeletons for a native loading feel"
```

---

## Self-Review

**Spec coverage:**
- Structured skeleton + crossfade → Task 6 (`SeriesHero` states), Task 7 (`EpisodeGrid` shimmer + fade), Task 9 (shimmer everywhere). ✔
- Optimistic hero from card → Task 5 (`seriesHint`), Task 8 (consume on mount, set on click), Task 6 (blurred backdrop + exact title). ✔
- Selection treatment A → Task 3 (box-shadow ring + lift). ✔
- Corner clip fix → Task 3 (ring via box-shadow outside `overflow-hidden`; inner ring div deleted). ✔
- Double-outline fix → Task 1 (`:not([data-focus-self])`) + `data-focus-self` on every self-ringed element (Tasks 3, 6, 7, 8). ✔
- Vertical page-jump fix → Task 2 (`block:'nearest'`). ✔
- Row clipping + edge peek → Task 3 (`py-8`, `scroll-padding-inline`). ✔
- Skeleton quality (shimmer) → Task 1 (utility) + Tasks 6/7/9 (applied). ✔
- Non-goals (prefetch, back-restore, round-trip collapse) → not implemented. ✔

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has an expected result. ✔

**Type consistency:** `SeriesHint` ({id,title,poster,isPremium}) defined in Task 5 and consumed identically in Tasks 6 and 8. `CrUpNext` defined in Task 4, used as the `upNext` prop type in Task 6 and the page state in Task 8. `setHint`/`takeHint` names match across Tasks 5 and 8. `data-focus-self` introduced in Task 1 and applied with the same spelling in Tasks 3, 6, 7, 8. `onplay` prop name matches between `SeriesHero`/`EpisodeGrid` and the page. ✔
