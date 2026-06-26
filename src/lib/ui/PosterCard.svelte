<script lang="ts">
  import type { CrItem } from '$lib/api/types'

  let { uid, item }: { uid: string; item: CrItem } = $props()

  const isEpisode = $derived(item.display === 'episode')
  const img = $derived(isEpisode ? item.background : (item.poster ?? item.background))
  // landscape thumb for episodes/movies, tall poster for series
  const size = $derived(isEpisode ? 'h-[150px] w-[266px]' : 'h-[290px] w-[195px]')
  const progress = $derived(
    item.playhead && item.duration ? Math.min(100, (item.playhead / item.duration) * 100) : 0
  )
</script>

<button
  id={uid}
  data-focusable
  title={item.title}
  class={`group relative shrink-0 overflow-hidden rounded-card bg-surface-2 outline-none transition-transform duration-150 ease-out select:scale-105 select:shadow-2xl select:shadow-black/60 ${size}`}
>
  <img src={img} alt={item.title} loading="lazy" class="h-full w-full object-cover" />
  <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
    <span class="line-clamp-2 text-left text-xs font-bold leading-tight">{item.title}</span>
  </div>
  {#if progress > 0}
    <div class="absolute inset-x-0 bottom-0 h-1 bg-white/25">
      <div class="h-full bg-brand" style="width:{progress}%"></div>
    </div>
  {/if}
  <div class="pointer-events-none absolute inset-0 rounded-card ring-0 ring-brand transition-all group-select:ring-4"></div>
</button>
