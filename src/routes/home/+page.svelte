<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import type { CrHome } from '$lib/api/types'
  import { getHome } from '$lib/api/homeStore'
  import Row from '$lib/ui/Row.svelte'
  import HeroBanner from '$lib/ui/HeroBanner.svelte'
  import SkeletonCard from '$lib/ui/SkeletonCard.svelte'

  let phase: 'loading' | 'ready' | 'error' = $state('loading')
  let home: CrHome | null = $state(null)
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
    const r = await getHome() // usually already resolved from the splash prefetch
    if (!r.ok) {
      phase = 'error'
      error = r.error
      return
    }
    home = r.home
    phase = 'ready'
    requestAnimationFrame(() => document.querySelector<HTMLElement>('section [data-focusable]')?.focus())
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
  <!-- APK-style skeletons (never a "loading feed" message) -->
  <div class="h-screen overflow-hidden p-10">
    <div class="mb-8 h-[42vh] animate-pulse rounded-card bg-surface-2"></div>
    {#each Array(3) as _row, r}
      <section class="mb-8">
        <div class="mb-3 h-5 w-48 animate-pulse rounded bg-surface-2"></div>
        <div class="flex gap-4 overflow-hidden">
          {#each Array(8) as _card}
            <SkeletonCard episode={r === 0} />
          {/each}
        </div>
      </section>
    {/each}
  </div>
{:else if home}
  <div class="h-screen overflow-y-auto p-10">
    <HeroBanner banners={home.banners} />
    {#each home.rows as row, i}
      <Row {row} index={i} />
    {/each}
  </div>
{/if}
