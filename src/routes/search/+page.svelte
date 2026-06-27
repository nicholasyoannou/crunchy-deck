<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import type { CrItem } from '$lib/api/types'
  import { mapItems } from '$lib/api/map'
  import { authGuard } from '$lib/api/guard'
  import PosterGrid from '$lib/ui/PosterGrid.svelte'
  import OnScreenKeyboard from '$lib/ui/OnScreenKeyboard.svelte'

  let query = $state('')
  let items: CrItem[] = $state([])
  let phase: 'idle' | 'searching' | 'ready' | 'error' = $state('idle')
  let error = $state('')
  let timer: ReturnType<typeof setTimeout> | undefined
  let seq = 0 // guards against out-of-order responses overwriting a newer query
  // Steam launch -> rely on the Steam OSK over the native field; bare launch -> in-app keyboard.
  let useOSK = $state(false)

  onMount(async () => {
    if (!window.cr) {
      phase = 'error'
      error = 'Preload bridge unavailable (window.cr missing).'
      return
    }
    const s = await window.cr.auth.status()
    if (!s.ok || !s.data.authenticated) {
      goto('/login')
      return
    }
    useOSK = !window.cr.steam
    // Land on the keyboard (bare) or the text field (Steam OSK) so typing starts immediately.
    requestAnimationFrame(() => document.getElementById(useOSK ? 'key-1-0' : 'search-input')?.focus())
  })

  onDestroy(() => clearTimeout(timer))

  // Called both by the on-screen keyboard and a physical keyboard typing in the box.
  function onQuery(v: string) {
    query = v
    clearTimeout(timer)
    const q = query.trim()
    if (!q) {
      items = []
      phase = 'idle'
      return
    }
    timer = setTimeout(() => runSearch(q), 250)
  }

  async function runSearch(q: string) {
    const mine = ++seq
    phase = 'searching'
    const res = await window.cr.api.search(q)
    if (mine !== seq) return // a newer keystroke already superseded this query
    if (!res.ok) {
      if (authGuard(res)) return
      phase = 'error'
      error = res.error
      return
    }
    items = mapItems(res.data)
    phase = 'ready'
  }
</script>

<div class="h-screen overflow-y-auto px-10 py-8">
  <!-- query field — focusable so the Steam OSK can attach on a Steam launch -->
  <div class="mb-4 flex items-center gap-3">
    <span class="text-lg text-white/40">🔍</span>
    <input
      id="search-input"
      data-focusable
      data-focus-self
      bind:value={query}
      oninput={() => onQuery(query)}
      placeholder="Search series and movies…"
      class="w-full max-w-xl rounded-card bg-surface-2 px-4 py-3 text-lg outline-none ring-2 ring-transparent select:ring-brand"
    />
  </div>

  {#if useOSK}
    <div class="mb-6 max-w-xl">
      <OnScreenKeyboard value={query} onchange={onQuery} />
    </div>
  {/if}

  {#if phase === 'error'}
    <p class="text-sm text-white/50">{error}</p>
  {:else if phase === 'idle'}
    <p class="text-sm text-white/40">Type to search Crunchyroll.</p>
  {:else if phase === 'ready' && items.length === 0}
    <p class="text-sm text-white/50">No results for “{query}”.</p>
  {:else}
    <PosterGrid {items} loading={phase === 'searching'} idPrefix="search" />
  {/if}
</div>
