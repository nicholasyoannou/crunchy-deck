<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { CrEpisode } from '$lib/api/types'

  let {
    episodes,
    loading,
    onplay
  }: {
    episodes: CrEpisode[]
    loading: boolean
    onplay: (epId: string, t?: number) => void
  } = $props()
</script>

{#if loading}
  <div class="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4">
    {#each Array(8) as _e}
      <div class="shimmer aspect-video rounded-card"></div>
    {/each}
  </div>
{:else}
  <div in:fade={{ duration: 200 }} class="grid grid-cols-2 gap-x-5 gap-y-7 md:grid-cols-3 xl:grid-cols-4">
    {#each episodes as ep, i}
      <button
        id={`ep-${i}`}
        data-focusable
        data-focus-self
        onclick={() => onplay(ep.id, ep.watched ? 0 : (ep.playhead ?? 0))}
        class="group text-left outline-none"
      >
        <div class="relative aspect-video overflow-hidden rounded-card bg-surface-2 transition group-select:shadow-[0_0_0_2px_#F47521]">
          <img
            src={ep.background}
            alt={ep.title}
            loading="lazy"
            class="h-full w-full object-cover transition-transform duration-150 group-select:scale-105 {ep.watched ? 'opacity-50' : ''}"
          />
          <div class="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition-opacity group-select:opacity-100">
            <div class="grid h-12 w-12 place-items-center rounded-full bg-black/60 pl-0.5 text-xl">▶</div>
          </div>
          {#if ep.premium}
            <span class="absolute left-1.5 top-1.5 text-brand drop-shadow" title="Premium">◆</span>
          {/if}
          {#if ep.watched}
            <span class="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-[11px] font-black text-black" title="Watched">✓</span>
          {:else if ep.duration}
            <span class="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold">{ep.duration}m</span>
          {/if}
          {#if ep.progress && ep.progress > 0 && !ep.watched}
            <div class="absolute inset-x-0 bottom-0 h-1 bg-white/25">
              <div class="h-full bg-brand" style="width:{ep.progress}%"></div>
            </div>
          {/if}
        </div>
        <div class="mt-2 text-xs font-bold text-white/50">Episode {ep.episodeNumber}</div>
        <div class="line-clamp-1 text-sm font-bold {ep.watched ? 'text-white/55' : ''}">{ep.title}</div>
        <div class="line-clamp-2 text-xs text-white/45">{ep.description}</div>
      </button>
    {/each}
  </div>
{/if}
