<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import type { CrBanner, CrRowDescriptor } from '$lib/api/types'
  import { getHome } from '$lib/api/homeStore'
  import { authGuard } from '$lib/api/guard'
  import Row from '$lib/ui/Row.svelte'
  import HeroBanner from '$lib/ui/HeroBanner.svelte'
  import SkeletonCard from '$lib/ui/SkeletonCard.svelte'

  let phase: 'loading' | 'ready' | 'error' = $state('loading')
  let banners: CrBanner[] = $state([])
  let rows: CrRowDescriptor[] = $state([])
  let error = $state('')

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
    const r = await getHome() // shell only — usually resolved from the splash prefetch
    if (!r.ok) {
      if (authGuard(r)) return
      phase = 'error'
      error = r.error
      return
    }
    banners = r.banners
    rows = r.rows
    phase = 'ready'
  })
</script>

{#if phase === 'error'}
  <div class="grid h-screen place-items-center text-center">
    <div>
      <p class="mb-2 text-xl font-bold text-brand">Couldn't load Home</p>
      <p class="max-w-md text-sm text-white/50">{error}</p>
    </div>
  </div>
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
{:else}
  <div class="h-screen overflow-y-auto">
    <HeroBanner {banners} />
    <div class="px-10 pb-10">
      {#each rows as row, i}
        <Row {row} index={i} />
      {/each}
    </div>
  </div>
{/if}
