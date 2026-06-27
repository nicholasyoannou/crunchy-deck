<script lang="ts">
  import { onMount } from 'svelte'

  let phase = $state<'none' | 'available' | 'downloading' | 'ready'>('none')
  let version = $state('')
  let percent = $state(0)

  onMount(() => {
    if (!window.cr?.update) return
    window.cr.update.onAvailable((d) => {
      version = d.version
      if (phase === 'none') phase = 'available'
    })
    window.cr.update.onProgress((d) => {
      percent = d.percent
      phase = 'downloading'
    })
    window.cr.update.onDownloaded((d) => {
      version = d.version
      phase = 'ready'
    })
  })

  function update() {
    phase = 'downloading'
    percent = 0
    window.cr.update.download()
  }
  function restart() {
    window.cr.update.install()
  }
  function dismiss() {
    phase = 'none'
  }
</script>

{#if phase !== 'none'}
  <div class="fixed bottom-5 right-5 z-[60] w-80 rounded-card bg-surface-1 p-4 shadow-2xl ring-1 ring-white/10">
    {#if phase === 'available'}
      <p class="mb-1 font-bold text-white">Update available</p>
      <p class="mb-3 text-sm text-white/60">Version {version} is ready to download.</p>
      <div class="flex gap-2">
        <button
          id="upd-now"
          data-focusable
          data-focus-self
          onclick={update}
          class="rounded bg-brand px-4 py-2 text-sm font-bold text-black outline-none select:ring-4 select:ring-white/40"
        >Update now</button>
        <button
          id="upd-later"
          data-focusable
          onclick={dismiss}
          class="rounded bg-white/10 px-4 py-2 text-sm font-semibold text-white outline-none select:bg-white/25"
        >Later</button>
      </div>
    {:else if phase === 'downloading'}
      <p class="mb-2 font-bold text-white">Downloading update… {percent}%</p>
      <div class="h-1.5 overflow-hidden rounded-full bg-white/15">
        <div class="h-full bg-brand transition-[width]" style="width:{percent}%"></div>
      </div>
    {:else}
      <p class="mb-1 font-bold text-white">Update ready</p>
      <p class="mb-3 text-sm text-white/60">Quit to apply {version}, then relaunch from Steam.</p>
      <button
        id="upd-restart"
        data-focusable
        data-focus-self
        onclick={restart}
        class="rounded bg-brand px-4 py-2 text-sm font-bold text-black outline-none select:ring-4 select:ring-white/40"
      >Quit &amp; apply</button>
    {/if}
  </div>
{/if}
