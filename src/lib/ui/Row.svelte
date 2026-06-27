<script lang="ts">
  import { onMount } from 'svelte'
  import type { CrItem, CrRowDescriptor } from '$lib/api/types'
  import { mapItems } from '$lib/api/map'
  import PosterCard from './PosterCard.svelte'
  import SkeletonCard from './SkeletonCard.svelte'

  let { row, index }: { row: CrRowDescriptor; index: number } = $props()
  let items: CrItem[] | null = $state(null)
  let section: HTMLElement

  async function load() {
    if (items) return
    if (!window.cr) {
      items = []
      return
    }
    // ids is a Svelte reactive Proxy array — spread to a plain array so IPC structuredClone works
    const res = await window.cr.api.row({ title: row.title, link: row.link, ids: row.ids ? [...row.ids] : undefined })
    items = res.ok ? mapItems(res.data) : []
  }

  function scrollParent(el: HTMLElement): HTMLElement | null {
    let p = el.parentElement
    while (p) {
      const oy = getComputedStyle(p).overflowY
      if (oy === 'auto' || oy === 'scroll') return p
      p = p.parentElement
    }
    return null
  }

  onMount(() => {
    // Observe against the actual scroll container, not the viewport — IO with root:null
    // doesn't reliably track a nested overflow-y-auto container, so lower rows never fired.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          load()
        }
      },
      { root: scrollParent(section), rootMargin: '800px 0px' }
    )
    io.observe(section)
    return () => io.disconnect()
  })
</script>

<section bind:this={section} class="mb-5" class:hidden={items !== null && items.length === 0}>
  <h2 class="mb-1.5 text-lg font-bold text-white/80">{row.title}</h2>
  <!-- -mx-10/px-10 full-bleeds the scroll track so the focus ring + glow have room at the
       first/last card instead of being clipped by overflow-x; cards stay aligned with the header. -->
  <div class="-mx-10 flex gap-4 overflow-x-auto px-10 pt-2 pb-8 [scroll-padding-inline:2.5rem]">
    {#if items === null}
      {#each Array(8) as _i}
        <SkeletonCard />
      {/each}
    {:else}
      {#each items as item, i}
        <PosterCard uid={`r${index}i${i}`} {item} />
      {/each}
    {/if}
  </div>
</section>

<style>
  section:focus-within :global([data-focus-self]:not(:focus):not(:hover)) {
    opacity: 0.82;
    transition: opacity 0.15s ease;
  }
</style>
