<script lang="ts">
  import { exitOpen, closeExit } from '$lib/nav/overlays'

  function quit() {
    closeExit()
    // Direct IPC -> app.exit(0) in main: a full, immediate teardown. window.close() (graceful) can
    // hang under gamescope and leave a lingering instance that blocks Steam's next launch.
    if (window.cr?.quit) window.cr.quit()
    else window.close()
  }

  // Default focus to the non-destructive choice; restore page focus on close.
  let wasOpen = false
  $effect(() => {
    const open = $exitOpen
    if (open && !wasOpen) {
      requestAnimationFrame(() => document.getElementById('exit-stay')?.focus())
    } else if (!open && wasOpen) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('#app-content [data-focusable]')?.focus()
      )
    }
    wasOpen = open
  })
</script>

{#if $exitOpen}
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/70">
    <div class="w-80 rounded-card bg-surface-1 p-6 text-center shadow-2xl">
      <p class="mb-1 text-lg font-black">Exit Crunchy Deck?</p>
      <p class="mb-5 text-sm text-white/50">You can jump back in anytime.</p>
      <div class="flex justify-center gap-3">
        <button
          id="exit-stay"
          data-focusable
          data-focus-self
          onclick={closeExit}
          class="rounded-card bg-surface-3 px-5 py-2.5 font-bold outline-none transition select:shadow-[0_0_0_2px_#F47521]"
          >Stay</button
        >
        <button
          id="exit-quit"
          data-focusable
          data-focus-self
          onclick={quit}
          class="rounded-card bg-brand px-5 py-2.5 font-bold text-black outline-none transition select:shadow-[0_0_0_2px_#fff]"
          >Quit</button
        >
      </div>
    </div>
  </div>
{/if}
