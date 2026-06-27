<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import type { CrItem } from '$lib/api/types'
  import { mapItems } from '$lib/api/map'
  import { authGuard } from '$lib/api/guard'
  import PosterGrid from '$lib/ui/PosterGrid.svelte'

  const N = 24
  const SORTS = [
    { key: 'popularity', label: 'Popular' },
    { key: 'newly_added', label: 'Newest' },
    { key: 'alphabetical', label: 'A–Z' }
  ]

  // Categories / Seasons deep-link in via these query params (locked design decision).
  const categories = $page.url.searchParams.get('categories') ?? undefined
  const seasonalTag = $page.url.searchParams.get('seasonal_tag') ?? undefined
  const heading = $page.url.searchParams.get('title') ?? 'Browse'

  let sort = $state('popularity')
  let items: CrItem[] = $state([])
  let phase: 'loading' | 'ready' | 'empty' | 'error' = $state('loading')
  let error = $state('')
  let start = 0
  let hasMore = $state(false)
  let loadingMore = $state(false)

  async function fetchPage(reset: boolean) {
    if (reset) {
      start = 0
      items = []
      phase = 'loading'
    } else {
      loadingMore = true
    }
    const res = await window.cr.api.browse({ sortBy: sort, categories, seasonalTag, n: N, start })
    if (!res.ok) {
      loadingMore = false
      if (authGuard(res)) return
      phase = 'error'
      error = res.error
      return
    }
    const mapped = mapItems(res.data)
    items = reset ? mapped : [...items, ...mapped]
    hasMore = mapped.length >= N
    start += mapped.length
    phase = items.length ? 'ready' : 'empty'
    loadingMore = false
  }

  function changeSort(k: string) {
    if (k === sort) return
    sort = k
    fetchPage(true)
  }

  // Auto-load the next page as the user nears the bottom (controller scroll triggers this too,
  // since moving focus down scrolls the container).
  function onScroll(e: Event) {
    if (phase !== 'ready' || !hasMore || loadingMore) return
    const el = e.currentTarget as HTMLElement
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 700) fetchPage(false)
  }

  onMount(async () => {
    if (!window.cr) {
      phase = 'error'
      error = 'Preload bridge unavailable.'
      return
    }
    const s = await window.cr.auth.status()
    if (!s.ok || !s.data.authenticated) {
      goto('/login')
      return
    }
    await fetchPage(true)
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('#app-content [data-focusable]')?.focus()
    )
  })
</script>

<div class="h-screen overflow-y-auto px-10 py-8" onscroll={onScroll}>
  <div class="mb-5 flex items-center gap-3">
    <h1 class="text-2xl font-black">{heading}</h1>
    <div class="ml-auto flex gap-2">
      {#each SORTS as s, i}
        <button
          id={`sort-${i}`}
          data-focusable
          data-focus-self
          onclick={() => changeSort(s.key)}
          class="rounded-full px-4 py-1.5 text-sm font-semibold outline-none transition select:ring-2 select:ring-brand {s.key ===
          sort
            ? 'bg-brand text-black'
            : 'bg-surface-2 text-white/80'}">{s.label}</button
        >
      {/each}
    </div>
  </div>

  {#if phase === 'error'}
    <p class="text-sm text-white/50">{error}</p>
  {:else if phase === 'empty'}
    <p class="text-sm text-white/50">Nothing to show here.</p>
  {:else}
    <PosterGrid {items} loading={phase === 'loading'} idPrefix="browse" />
    {#if loadingMore}
      <p class="mt-8 text-center text-sm text-white/40">Loading more…</p>
    {/if}
  {/if}
</div>
