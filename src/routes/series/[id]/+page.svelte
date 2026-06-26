<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { mapSeriesInfo, mapSeasons, mapEpisodes } from '$lib/api/map'
  import type { CrSeriesInfo, CrSeason, CrEpisode } from '$lib/api/types'

  let id = $derived($page.params.id ?? '')
  let phase: 'loading' | 'ready' | 'error' = $state('loading')
  let info: CrSeriesInfo | null = $state(null)
  let seasons: CrSeason[] = $state([])
  let selected = $state(0)
  let episodes: CrEpisode[] = $state([])
  let epsLoading = $state(false)
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

  function play(ep: CrEpisode) {
    goto(`/watch/${ep.id}`)
  }

  onMount(async () => {
    if (!window.cr) {
      phase = 'error'
      error = 'Preload bridge unavailable.'
      return
    }
    const res = await window.cr.api.series(id)
    if (!res.ok) {
      phase = 'error'
      error = res.error
      return
    }
    info = mapSeriesInfo(res.data.series)
    seasons = mapSeasons(res.data.seasons)
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
{:else if phase === 'loading'}
  <div class="h-screen animate-pulse bg-surface-1"></div>
{:else if info}
  <div class="h-screen overflow-y-auto">
    <!-- hero -->
    <div class="relative h-[46vh] overflow-hidden">
      <img src={info.background} alt={info.title} class="h-full w-full object-cover" />
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface via-surface/60 to-transparent"></div>
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent"></div>
      <div class="absolute bottom-8 left-10 max-w-[55%]">
        <h1 class="mb-3 text-4xl font-black drop-shadow-lg">{info.title}</h1>
        <p class="line-clamp-3 text-sm text-white/75 drop-shadow">{info.description}</p>
      </div>
    </div>

    <div class="px-10 pb-16">
      <!-- season selector -->
      {#if seasons.length > 1}
        <div class="mb-5 flex flex-wrap gap-2">
          {#each seasons as season, i}
            <button
              data-focusable
              onclick={() => selectSeason(i)}
              class="rounded-full px-4 py-1.5 text-sm font-semibold outline-none transition select:ring-2 select:ring-brand {i ===
              selected
                ? 'bg-brand text-black'
                : 'bg-surface-2 text-white/80'}"
            >{season.number}. {season.title}</button>
          {/each}
        </div>
      {/if}

      <!-- episodes -->
      {#if epsLoading}
        <div class="space-y-3">
          {#each Array(6) as _e}
            <div class="h-[104px] animate-pulse rounded-card bg-surface-2"></div>
          {/each}
        </div>
      {:else}
        <div class="space-y-3">
          {#each episodes as ep, i}
            <button
              id={`ep-${i}`}
              data-focusable
              onclick={() => play(ep)}
              class="group flex w-full items-center gap-4 overflow-hidden rounded-card bg-surface-1 p-2 text-left outline-none transition select:bg-surface-2 select:ring-2 select:ring-brand"
            >
              <div class="relative h-[90px] w-[160px] shrink-0 overflow-hidden rounded">
                <img src={ep.background} alt={ep.title} loading="lazy" class="h-full w-full object-cover" />
                <div class="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-select:opacity-100">
                  <div class="grid h-10 w-10 place-items-center rounded-full bg-black/60 pl-0.5">▶</div>
                </div>
                {#if ep.premium}
                  <span class="absolute right-1 top-1 text-brand drop-shadow" title="Premium">◆</span>
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <div class="mb-1 flex items-center gap-2 text-xs font-semibold text-white/60">
                  <span>E{ep.episodeNumber}</span>
                  {#if ep.duration}<span>· {ep.duration}m</span>{/if}
                </div>
                <div class="truncate font-bold">{ep.title}</div>
                <div class="line-clamp-2 text-xs text-white/50">{ep.description}</div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
