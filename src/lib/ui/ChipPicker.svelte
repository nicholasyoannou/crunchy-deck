<script lang="ts">
  import { goto } from '$app/navigation'
  import { fade } from 'svelte/transition'

  type Chip = { id: string; title: string; image?: string }

  // Reusable focusable chip wall for the Categories / Seasons pickers; each chip deep-links
  // (via href) into the shared /browse grid. Chips that carry an `image` (genres) drive a
  // full-bleed backdrop that cross-fades as you highlight them, like the CR TV categories screen.
  let {
    title,
    chips,
    loading,
    error = '',
    idPrefix,
    href
  }: {
    title: string
    chips: Chip[]
    loading: boolean
    error?: string
    idPrefix: string
    href: (chip: Chip) => string
  } = $props()

  let backdrop = $state('') // artwork of the focused chip; '' when chips have no images (e.g. Seasons)
</script>

<div class="relative h-screen overflow-y-auto">
  {#if backdrop}
    {#key backdrop}
      <img
        src={backdrop}
        alt=""
        in:fade={{ duration: 450 }}
        out:fade={{ duration: 450 }}
        class="pointer-events-none fixed inset-0 h-full w-full object-cover"
      />
    {/key}
    <!-- scrims: darken top (title/chips) + bottom so the art reads as a backdrop, not clutter -->
    <div class="pointer-events-none fixed inset-0 bg-gradient-to-b from-surface via-surface/30 to-transparent"></div>
    <div class="pointer-events-none fixed inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent"></div>
  {/if}

  <div class="relative z-10 px-10 py-8">
    <h1 class="mb-6 text-2xl font-black drop-shadow">{title}</h1>
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
            onfocus={() => {
              if (chip.image) backdrop = chip.image
            }}
            class="rounded-full bg-surface-2/90 px-5 py-2.5 text-sm font-bold text-white/85 outline-none backdrop-blur-sm transition select:bg-brand select:text-black select:ring-2 select:ring-brand"
            >{chip.title}</button
          >
        {/each}
      </div>
    {/if}
  </div>
</div>
