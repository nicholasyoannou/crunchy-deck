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

  // mousedown + preventDefault so the pad never steals focus from the content
  function press(cmd: NavCommand, e: Event) {
    e.preventDefault()
    dispatchCommand(cmd)
  }

  const dpad = 'grid h-8 w-8 place-items-center rounded bg-white/10 text-xs text-white hover:bg-brand hover:text-black'
  const face = 'grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white'
</script>

{#if !hasGamepad}
  <div class="fixed bottom-4 right-4 z-[60] select-none opacity-40 transition-opacity hover:opacity-100">
    <div class="rounded-xl border border-white/10 bg-black/75 p-3 backdrop-blur">
      <div class="mb-2 text-center text-[10px] uppercase tracking-wide text-white/50">Test controls</div>
      <div class="flex items-center gap-4">
        <div class="grid grid-cols-3 grid-rows-3 gap-1">
          <span></span>
          <button tabindex="-1" onmousedown={(e) => press('up', e)} class={dpad}>▲</button>
          <span></span>
          <button tabindex="-1" onmousedown={(e) => press('left', e)} class={dpad}>◀</button>
          <span class="grid place-items-center text-white/25">○</span>
          <button tabindex="-1" onmousedown={(e) => press('right', e)} class={dpad}>▶</button>
          <span></span>
          <button tabindex="-1" onmousedown={(e) => press('down', e)} class={dpad}>▼</button>
          <span></span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <button tabindex="-1" onmousedown={(e) => press('confirm', e)} class={`${face} bg-brand text-black`}>A</button>
          <button tabindex="-1" onmousedown={(e) => press('cancel', e)} class={`${face} bg-white/15`}>B</button>
          <button tabindex="-1" onmousedown={(e) => press('menu', e)} class="grid h-8 place-items-center rounded-full bg-white/10 px-2 text-[10px] font-bold text-white">MENU</button>
        </div>
      </div>
    </div>
  </div>
{/if}
