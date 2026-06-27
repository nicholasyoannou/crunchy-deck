<script lang="ts">
  import { goto } from '$app/navigation'

  // Reusable focusable chip wall for the Categories / Seasons pickers; each chip deep-links
  // (via href) into the shared /browse grid.
  let {
    title,
    chips,
    loading,
    error = '',
    idPrefix,
    href
  }: {
    title: string
    chips: { id: string; title: string }[]
    loading: boolean
    error?: string
    idPrefix: string
    href: (chip: { id: string; title: string }) => string
  } = $props()
</script>

<div class="h-screen overflow-y-auto px-10 py-8">
  <h1 class="mb-6 text-2xl font-black">{title}</h1>
  {#if error}
    <p class="text-sm text-white/50">{error}</p>
  {:else if loading}
    <div class="flex flex-wrap gap-3">
      {#each Array(12) as _c}
        <div class="shimmer h-11 w-32 rounded-full"></div>
      {/each}
    </div>
  {:else if chips.length === 0}
    <p class="text-sm text-white/50">Nothing to show.</p>
  {:else}
    <div class="flex flex-wrap gap-3">
      {#each chips as chip, i}
        <button
          id={`${idPrefix}-${i}`}
          data-focusable
          data-focus-self
          onclick={() => goto(href(chip))}
          class="rounded-full bg-surface-2 px-5 py-2.5 text-sm font-bold text-white/85 outline-none transition select:bg-brand select:text-black select:ring-2 select:ring-brand"
          >{chip.title}</button
        >
      {/each}
    </div>
  {/if}
</div>
