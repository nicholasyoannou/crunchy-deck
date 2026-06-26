<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { mapHome } from '$lib/api/map'
  import type { CrHome } from '$lib/api/types'
  import Row from '$lib/ui/Row.svelte'

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
    const res = await window.cr.api.home('en-US')
    if (!res.ok) {
      phase = 'error'
      error = res.error
      return
    }
    home = mapHome(res.data.feed, res.data.itemsByRow)
    phase = 'ready'
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-focusable]')?.focus())
  })
</script>

{#if phase === 'loading'}
  <div class="grid h-screen place-items-center text-white/60">Loading your feed…</div>
{:else if phase === 'error'}
  <div class="grid h-screen place-items-center text-center">
    <div>
      <p class="mb-2 text-xl font-bold text-brand">Couldn't load Home</p>
      <p class="max-w-md text-sm text-white/50">{error}</p>
    </div>
  </div>
{:else if home}
  <div class="h-screen overflow-y-auto p-10">
    {#if home.banner}
      <div class="relative mb-8 h-[40vh] overflow-hidden rounded-card">
        <img src={home.banner.background} alt={home.banner.title} class="h-full w-full object-cover" />
        <div class="absolute inset-0 bg-gradient-to-t from-surface to-transparent"></div>
        <div class="absolute bottom-6 left-6 max-w-[60%]">
          <h1 class="mb-2 text-4xl font-black">{home.banner.title}</h1>
          <p class="line-clamp-2 text-white/70">{home.banner.description}</p>
        </div>
      </div>
    {/if}
    {#each home.rows as row, i}
      <Row {row} index={i} />
    {/each}
  </div>
{/if}
