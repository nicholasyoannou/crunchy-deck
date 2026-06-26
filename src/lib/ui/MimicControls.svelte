<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { dispatchCommand } from '$lib/input/commands'
  import type { NavCommand } from '$lib/input/gamepad'

  // Only show on a machine WITHOUT a controller (i.e. testing on a laptop, not the Deck).
  let hasGamepad = $state(false)
  function check() {
    hasGamepad = (navigator.getGamepads?.() ?? []).some(Boolean)
  }
  onMount(() => {
    check()
    window.addEventListener('gamepadconnected', check)
    window.addEventListener('gamepaddisconnected', check)
  })
  onDestroy(() => {
    window.removeEventListener('gamepadconnected', check)
    window.removeEventListener('gamepaddisconnected', check)
  })

  // <div> (not <button>) + preventDefault so the pad NEVER steals focus from the content.
  function press(cmd: NavCommand, e: Event) {
    e.preventDefault()
    dispatchCommand(cmd)
  }

  const dpad =
    'grid h-9 w-9 cursor-pointer place-items-center rounded bg-white/10 text-sm text-white hover:bg-brand hover:text-black active:scale-90'
  const face =
    'grid h-9 w-9 cursor-pointer place-items-center rounded-full text-sm font-bold text-white active:scale-90'
</script>

{#if !hasGamepad}
  <div class="fixed bottom-4 right-4 z-[60] select-none opacity-50 transition-opacity hover:opacity-100">
    <div class="rounded-xl border border-white/10 bg-black/80 p-3 backdrop-blur">
      <div class="mb-2 text-center text-[10px] uppercase tracking-wide text-white/50">Test controls</div>
      <div class="flex items-center gap-4">
        <div class="grid grid-cols-3 grid-rows-3 gap-1">
          <span></span>
          <div role="button" tabindex="-1" aria-label="Up" onmousedown={(e) => press('up', e)} class={dpad}>▲</div>
          <span></span>
          <div role="button" tabindex="-1" aria-label="Left" onmousedown={(e) => press('left', e)} class={dpad}>◀</div>
          <span class="grid place-items-center text-white/25">○</span>
          <div role="button" tabindex="-1" aria-label="Right" onmousedown={(e) => press('right', e)} class={dpad}>▶</div>
          <span></span>
          <div role="button" tabindex="-1" aria-label="Down" onmousedown={(e) => press('down', e)} class={dpad}>▼</div>
          <span></span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <div role="button" tabindex="-1" aria-label="A confirm" onmousedown={(e) => press('confirm', e)} class={`${face} bg-brand text-black`}>A</div>
          <div role="button" tabindex="-1" aria-label="B back" onmousedown={(e) => press('cancel', e)} class={`${face} bg-white/15`}>B</div>
          <div role="button" tabindex="-1" aria-label="Menu" onmousedown={(e) => press('menu', e)} class="grid h-9 cursor-pointer place-items-center rounded-full bg-white/10 px-2 text-[10px] font-bold text-white active:scale-90">MENU</div>
        </div>
      </div>
    </div>
  </div>
{/if}
