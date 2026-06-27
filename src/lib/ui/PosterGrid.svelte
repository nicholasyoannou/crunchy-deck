<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { CrItem } from '$lib/api/types'
  import PosterCard from './PosterCard.svelte'

  // Generic CrItem wall reused by Search, Browse, Categories, Watchlist, History.
  // Fixed 3-up on the Deck handheld; scales up when docked to a larger display.
  // idPrefix keeps focusable ids unique when more than one grid shares a page.
  let {
    items,
    loading,
    idPrefix = 'grid'
  }: { items: CrItem[]; loading: boolean; idPrefix?: string } = $props()

  const COLS = 'grid grid-cols-3 gap-x-5 gap-y-7 xl:grid-cols-5 2xl:grid-cols-6'
</script>

{#if loading}
  <div class={COLS}>
    {#each Array(12) as _c}
      <div class="shimmer aspect-[195/290] w-full rounded-card"></div>
    {/each}
  </div>
{:else}
  <div in:fade={{ duration: 200 }} class={COLS}>
    {#each items as item, i (item.id + '-' + i)}
      <PosterCard fill uid={`${idPrefix}-${i}`} {item} />
    {/each}
  </div>
{/if}
