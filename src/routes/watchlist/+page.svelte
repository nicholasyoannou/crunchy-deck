<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import type { CrItem } from '$lib/api/types'
  import { mapItems } from '$lib/api/map'
  import { authGuard } from '$lib/api/guard'
  import PosterGrid from '$lib/ui/PosterGrid.svelte'

  let phase: 'loading' | 'ready' | 'empty' | 'error' = $state('loading')
  let items: CrItem[] = $state([])
  let error = $state('')

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
    const res = await window.cr.api.watchlist()
    if (!res.ok) {
      if (authGuard(res)) return
      phase = 'error'
      error = res.error
      return
    }
    items = mapItems(res.data)
    phase = items.length ? 'ready' : 'empty'
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('#app-content [data-focusable]')?.focus()
    )
  })
</script>

<div class="h-screen overflow-y-auto px-10 py-8">
  <h1 class="mb-6 text-2xl font-black">Watchlist</h1>
  {#if phase === 'error'}
    <p class="text-sm text-white/50">{error}</p>
  {:else if phase === 'empty'}
    <p class="text-sm text-white/50">Nothing saved yet — add titles with the bookmark button on a series.</p>
  {:else}
    <PosterGrid {items} loading={phase === 'loading'} idPrefix="wl" />
  {/if}
</div>
