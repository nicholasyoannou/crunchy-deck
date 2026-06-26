<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { CrBanner } from '$lib/api/types'

  let { banners }: { banners: CrBanner[] } = $props()

  let index = $state(0)
  let paused = $state(false)
  let progress = $state(0) // 0..1, drives the active dot's orange fill
  const INTERVAL = 7000
  let raf = 0
  let last: number | null = null

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
    if (!paused && banners.length > 1) {
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
    class="group relative mb-8 h-[42vh] overflow-hidden rounded-card"
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
    <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent"></div>

    <div class="absolute bottom-8 left-8 max-w-[55%]">
      <h1 class="mb-2 text-4xl font-black drop-shadow-lg">{banners[index].title}</h1>
      <p class="line-clamp-2 text-white/80 drop-shadow">{banners[index].description}</p>
    </div>

    <button
      data-focusable
      aria-label="Previous"
      onclick={() => manual(index - 1)}
      class="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-3xl text-white opacity-0 outline-none transition-opacity duration-200 group-hover:opacity-100 select:bg-brand select:opacity-100"
    >‹</button>
    <button
      data-focusable
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
