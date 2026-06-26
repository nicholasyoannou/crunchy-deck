<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { mapSeriesInfo, mapSeasons, mapEpisodes } from '$lib/api/map'
  import type { CrSeriesInfo, CrSeason, CrEpisode } from '$lib/api/types'

  type UpNext = { id: string; seasonNumber: number; episodeNumber: number; playhead: number; fullyWatched: boolean } | null

  let id = $derived($page.params.id ?? '')
  let phase: 'loading' | 'ready' | 'error' = $state('loading')
  let info: CrSeriesInfo | null = $state(null)
  let seasons: CrSeason[] = $state([])
  let selected = $state(0)
  let episodes: CrEpisode[] = $state([])
  let epsLoading = $state(false)
  let upNext: UpNext = $state(null)
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
    const res = await window.cr.api.series(id)
    if (!res.ok) {
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
{:else if phase === 'loading'}
  <div class="h-screen animate-pulse bg-surface-1"></div>
{:else if info}
  <div class="h-screen overflow-y-auto">
    <!-- hero -->
    <div class="relative h-[52vh] overflow-hidden">
      <img src={info.background} alt={info.title} class="h-full w-full object-cover" />
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface via-surface/60 to-transparent"></div>
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent"></div>
      <div class="absolute bottom-8 left-10 max-w-[55%]">
        <h1 class="mb-3 text-4xl font-black drop-shadow-lg">{info.title}</h1>
        <p class="mb-5 line-clamp-3 text-sm text-white/75 drop-shadow">{info.description}</p>
        <button
          data-focusable
          onclick={playMain}
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-7 py-3 font-bold text-black outline-none transition select:ring-4 select:ring-white/40"
        >
          <span class="text-lg">▶</span>
          {upNext && !upNext.fullyWatched ? `Continue · S${upNext.seasonNumber} E${upNext.episodeNumber}` : 'Play'}
        </button>
      </div>
    </div>

    <div class="px-10 pb-16">
      <!-- season selector -->
      {#if seasons.length > 1}
        <div class="mb-6 flex flex-wrap gap-2">
          {#each seasons as season, i}
            <button
              data-focusable
              onclick={() => selectSeason(i)}
              class="rounded-full px-4 py-1.5 text-sm font-semibold outline-none transition select:ring-2 select:ring-brand {i ===
              selected
                ? 'bg-brand text-black'
                : 'bg-surface-2 text-white/80'}"
            >{season.title}</button>
          {/each}
        </div>
      {/if}

      <!-- episode grid -->
      {#if epsLoading}
        <div class="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4">
          {#each Array(8) as _e}
            <div class="aspect-video animate-pulse rounded-card bg-surface-2"></div>
          {/each}
        </div>
      {:else}
        <div class="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4">
          {#each episodes as ep, i}
            <button
              id={`ep-${i}`}
              data-focusable
              onclick={() => play(ep.id, ep.watched ? 0 : (ep.playhead ?? 0))}
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
    </div>
  </div>
{/if}
