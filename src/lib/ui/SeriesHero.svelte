<script lang="ts">
  import type { CrSeriesInfo, CrUpNext } from '$lib/api/types'
  import type { SeriesHint } from '$lib/api/seriesHint'

  let {
    hint,
    info,
    upNext,
    onplay,
    inWatchlist = null,
    ontoggle
  }: {
    hint: SeriesHint | null
    info: CrSeriesInfo | null
    upNext: CrUpNext
    onplay: () => void
    inWatchlist?: boolean | null
    ontoggle?: () => void
  } = $props()

  let bgLoaded = $state(false)
  const title = $derived(info?.title ?? hint?.title ?? '')

  // Snap the scroll container to the top when the play button takes focus, so the full hero shows.
  function heroFocus(e: FocusEvent) {
    let p = (e.currentTarget as HTMLElement).parentElement
    while (p) {
      const oy = getComputedStyle(p).overflowY
      if (oy === 'auto' || oy === 'scroll') {
        p.scrollTo({ top: 0, behavior: 'smooth' })
        break
      }
      p = p.parentElement
    }
  }
  const playLabel = $derived(
    upNext && !upNext.fullyWatched
      ? `Continue · S${upNext.seasonNumber} E${upNext.episodeNumber}`
      : 'Play'
  )
</script>

<div class="relative h-[58vh] overflow-hidden">
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
      <div class="flex items-center gap-3">
        <button
          id="hero-play"
          data-focusable
          data-focus-self
          onclick={onplay}
          onfocus={heroFocus}
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-7 py-3 font-bold text-black outline-none transition select:ring-4 select:ring-white/40"
        >
          <span class="text-lg">▶</span>
          {playLabel}
        </button>
        {#if ontoggle && inWatchlist !== null}
          <button
            id="hero-watchlist"
            data-focusable
            data-focus-self
            onclick={ontoggle}
            aria-pressed={inWatchlist}
            class="inline-flex items-center gap-2 rounded-lg bg-surface-2/90 px-5 py-3 font-bold text-white outline-none transition select:ring-4 select:ring-white/30"
          >
            <span class="text-lg">{inWatchlist ? '✓' : '＋'}</span>
            {inWatchlist ? 'In Watchlist' : 'Watchlist'}
          </button>
        {/if}
      </div>
    {:else}
      <div class="shimmer h-12 w-44 rounded-lg"></div>
    {/if}
  </div>
</div>
