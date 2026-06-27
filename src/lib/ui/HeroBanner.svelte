<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import type { CrBanner } from '$lib/api/types'

  let { banners }: { banners: CrBanner[] } = $props()

  let index = $state(0)
  let paused = $state(false)
  let progress = $state(0) // 0..1, drives the active dot's orange fill
  let logoFailed = $state(new Set<number>())
  function failLogo(i: number) {
    logoFailed = new Set(logoFailed).add(i)
  }
  const INTERVAL = 7000
  let raf = 0
  let last: number | null = null

  // per-card detail (rating / sub-dub / genres / resume episode), fetched lazily for the active card
  let details = $state<Record<string, any>>({})
  let btnFocus = $state(false) // pause auto-advance while a hero button is focused (stable selection)
  async function fetchDetail(id: string) {
    if (!id || details[id]) return
    const r = await window.cr.api.heroDetail(id)
    if (r.ok) details = { ...details, [id]: r.data }
  }
  $effect(() => {
    const b = banners[index]
    if (b) fetchDetail(b.id)
  })
  const active = $derived(banners[index] ? details[banners[index].id] : undefined)
  const titleCase = (str: string) => str.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const subDub = (d: any) => [d?.isSubbed ? 'Sub' : '', d?.isDubbed ? 'Dub' : ''].filter(Boolean).join(' | ')
  const playLabel = $derived(
    active?.upNext && active.upNext.playhead > 0 && !active.upNext.fullyWatched ? 'Continue' : 'Play'
  )
  function play() {
    const b = banners[index]
    if (!b) return
    const un = active?.upNext
    if (un) goto(`/watch/${un.id}${un.playhead > 0 ? `?t=${Math.floor(un.playhead)}` : ''}`)
    else goto(`/series/${b.id}`)
  }

  // Focusing a hero control snaps its scroll container to the very top so the WHOLE hero
  // (art + logo) is shown — block:'nearest' otherwise leaves the hero partly scrolled off.
  function heroFocus(e: FocusEvent) {
    btnFocus = true
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

  function go(i: number) {
    if (banners.length) index = ((i % banners.length) + banners.length) % banners.length
  }
  function manual(i: number) {
    go(i)
    progress = 0
    last = null
  }

  function tick(t: number) {
    if (last == null) last = t
    const dt = t - last
    last = t
    if (!paused && !btnFocus && banners.length > 1) {
      progress += dt / INTERVAL
      if (progress >= 1) {
        progress = 0
        go(index + 1)
      }
    }
    raf = requestAnimationFrame(tick)
  }

  onMount(() => {
    raf = requestAnimationFrame(tick)
  })
  onDestroy(() => cancelAnimationFrame(raf))
</script>

{#if banners.length}
  <div
    class="group relative mb-6 h-[60vh] overflow-hidden"
    role="group"
    onmouseenter={() => (paused = true)}
    onmouseleave={() => (paused = false)}
  >
    {#each banners as b, i}
      <img
        src={b.background}
        alt={b.title}
        class="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
        style="opacity:{i === index ? 1 : 0}"
      />
    {/each}
    <!-- art bleeds on the right; left + bottom fade into the surface behind the logo/text -->
    <div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface via-surface/60 to-transparent"></div>
    <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface/90 via-transparent to-transparent"></div>

    <div class="absolute bottom-10 left-10 max-w-[48%]">
      {#if banners[index].logo && !logoFailed.has(index)}
        <img
          src={banners[index].logo}
          alt={banners[index].title}
          onerror={() => failLogo(index)}
          class="mb-4 max-h-24 max-w-[70%] object-contain object-left-bottom drop-shadow-lg"
        />
      {:else}
        <h1 class="mb-3 text-4xl font-black drop-shadow-lg">{banners[index].title}</h1>
      {/if}

      <!-- rating ◆ Sub | Dub ◆ genres -->
      {#if active}
        <div class="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm drop-shadow">
          {#if active.rating}
            <span class="rounded border border-white/45 px-1.5 py-0.5 text-xs font-bold text-white">{active.rating}</span>
          {/if}
          {#if subDub(active)}
            <span class="select-none text-[0.6rem] leading-none text-white/40">◆</span><span class="text-white/75">{subDub(active)}</span>
          {/if}
          {#if active.genres.length}
            <span class="select-none text-[0.6rem] leading-none text-white/40">◆</span>
            <span class="text-white/75">{active.genres.slice(0, 4).map(titleCase).join(', ')}</span>
          {/if}
        </div>
      {/if}

      <p class="mb-5 line-clamp-2 max-w-xl text-sm text-white/80 drop-shadow">{banners[index].description}</p>

      <div class="flex items-center gap-3">
        <button
          id="hero-play"
          data-focusable
          data-focus-self
          onclick={play}
          onfocus={heroFocus}
          onblur={() => (btnFocus = false)}
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-7 py-3 font-bold text-black outline-none transition select:ring-4 select:ring-white/40"
        >
          <span class="text-lg">▶</span>{playLabel}
        </button>
        <button
          id="hero-info"
          data-focusable
          onclick={() => goto(`/series/${banners[index].id}`)}
          onfocus={heroFocus}
          onblur={() => (btnFocus = false)}
          class="inline-flex items-center gap-2 rounded-lg bg-white/15 px-5 py-3 font-semibold text-white outline-none transition select:bg-white/30 select:ring-4 select:ring-white/30"
        >Details</button>
      </div>
    </div>

    <button
      aria-label="Previous"
      onclick={() => manual(index - 1)}
      class="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-3xl text-white opacity-0 outline-none transition-opacity duration-200 group-hover:opacity-100 select:bg-brand select:opacity-100"
    >‹</button>
    <button
      aria-label="Next"
      onclick={() => manual(index + 1)}
      class="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-3xl text-white opacity-0 outline-none transition-opacity duration-200 group-hover:opacity-100 select:bg-brand select:opacity-100"
    >›</button>

    <div class="absolute bottom-4 right-6 flex items-center gap-2">
      {#each banners as _, i}
        <button
          aria-label={`Slide ${i + 1}`}
          onclick={() => manual(i)}
          class="h-2 overflow-hidden rounded-full transition-all {i === index ? 'w-10 bg-white/30' : 'w-2 bg-white/40'}"
        >
          {#if i === index}
            <div class="h-full bg-brand" style="width:{progress * 100}%"></div>
          {/if}
        </button>
      {/each}
    </div>
  </div>
{/if}
