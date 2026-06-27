<script lang="ts">
  import { goto } from '$app/navigation'
  import type { CrItem } from '$lib/api/types'
  import { setHint } from '$lib/api/seriesHint'

  let { uid, item }: { uid: string; item: CrItem } = $props()

  const isEpisode = $derived(item.display === 'episode')
  const img = $derived(isEpisode ? item.background : (item.poster ?? item.background))
  const size = $derived(isEpisode ? 'h-[150px] w-[266px]' : 'h-[290px] w-[195px]')
  const progress = $derived(
    item.playhead && item.duration ? Math.min(100, (item.playhead / item.duration) * 100) : 0
  )
  const timeLeft = $derived(
    item.duration != null && item.playhead != null ? Math.max(0, item.duration - item.playhead) : null
  )
  const epLabel = $derived(
    item.seasonNumber && item.episodeNumber
      ? `S${item.seasonNumber} E${item.episodeNumber}`
      : item.episodeNumber
        ? `E${item.episodeNumber}`
        : ''
  )
</script>

<button
  id={uid}
  data-focusable
  data-focus-self
  title={item.title}
  onclick={() => {
    setHint({ id: item.id, title: item.title, poster: item.poster ?? item.background, isPremium: !!item.isPremium })
    goto(`/series/${item.id}`)
  }}
  class={`group relative shrink-0 origin-bottom overflow-hidden rounded-card bg-surface-2 outline-none transition-[transform,box-shadow] duration-150 ease-out select:-translate-y-[7px] select:scale-105 select:shadow-[0_0_0_3px_#F47521,0_14px_34px_rgba(0,0,0,0.65)] ${size}`}
>
  <img src={img} alt={item.title} loading="lazy" class="h-full w-full object-cover" />

  {#if item.isNew}
    <span
      class="absolute left-2 top-2 rounded bg-brand px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-black"
      >New</span
    >
  {/if}
  {#if item.isPremium}
    <span class="absolute right-2 top-2 text-base text-brand drop-shadow" title="Premium">◆</span>
  {/if}

  <!-- play affordance (prominent on Continue Watching) -->
  <div
    class="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity group-select:opacity-100"
  >
    <div class="grid h-12 w-12 place-items-center rounded-full bg-black/60 pl-0.5 text-xl text-white">▶</div>
  </div>

  <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
    {#if isEpisode && (epLabel || (timeLeft != null && progress > 0))}
      <div class="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
        {#if epLabel}<span>{epLabel}</span>{/if}
        {#if timeLeft != null && progress > 0}<span>· {timeLeft}m left</span>{/if}
      </div>
    {/if}
    <span class="line-clamp-2 text-left text-xs font-bold leading-tight">{item.title}</span>
  </div>

  {#if progress > 0}
    <div class="absolute inset-x-0 bottom-0 h-1 bg-white/25">
      <div class="h-full bg-brand" style="width:{progress}%"></div>
    </div>
  {/if}

</button>
