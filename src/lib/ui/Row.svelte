<script lang="ts">
  import type { CrRow } from '$lib/api/types'
  import PosterCard from './PosterCard.svelte'

  let { row, index }: { row: CrRow; index: number } = $props()
</script>

<section class="mb-8">
  <h2 class="mb-3 text-lg font-bold text-white/80">{row.title}</h2>
  <div class="flex gap-4 overflow-x-auto pb-2">
    {#each row.items as item, i}
      <PosterCard uid={`r${index}i${i}`} {item} />
    {/each}
  </div>
</section>
