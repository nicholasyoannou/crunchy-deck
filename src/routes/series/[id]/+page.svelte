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
  let inWatchlist: boolean | null = $state(null)
  let wlBusy = false
  let error = $state('')

  async function toggleWatchlist() {
    if (wlBusy || inWatchlist === null) return
    const want = !inWatchlist
    inWatchlist = want // optimistic
    wlBusy = true
    const res = want
      ? await window.cr.api.watchlistAdd(startId)
      : await window.cr.api.watchlistRemove(startId)
    wlBusy = false
    if (!res.ok) {
      inWatchlist = !want // revert on failure
      authGuard(res)
    }
  }

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
    // non-blocking: resolve the bookmark state once the page is up
    window.cr.api.watchlistCheck(startId).then((r) => {
      if (r.ok) inWatchlist = r.data
    })
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
  <div class="h-screen overflow-y-auto" style="scroll-padding-top:1.5rem">
    <SeriesHero {hint} {info} {upNext} onplay={playMain} {inWatchlist} ontoggle={toggleWatchlist} />

    <div class="px-10 pb-16 pt-3">
      {#if info && seasons.length > 1}
        <div class="mb-6 flex flex-wrap gap-2">
          {#each seasons as season, i}
            <button
              id={`season-${i}`}
              data-focusable
              data-focus-self
              data-up="#hero-play"
              data-down="#ep-0"
              data-left={i > 0 ? `#season-${i - 1}` : undefined}
              data-right={i < seasons.length - 1 ? `#season-${i + 1}` : undefined}
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
