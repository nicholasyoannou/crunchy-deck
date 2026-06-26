<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { startGamepadPoller } from '$lib/input/poller'
  import { ensureFocus } from '$lib/input/navigate'
  import { dispatchCommand } from '$lib/input/commands'
  import MimicControls from '$lib/ui/MimicControls.svelte'

  let { children } = $props()

  onMount(() => {
    const stop = startGamepadPoller()
    const id = setInterval(ensureFocus, 500)

    const onKey = (e: KeyboardEvent) => {
      const a = document.activeElement
      const typing = !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')
      let cmd: 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | null = null
      if (e.key === 'ArrowUp') cmd = 'up'
      else if (e.key === 'ArrowDown') cmd = 'down'
      else if (e.key === 'ArrowLeft') cmd = typing ? null : 'left'
      else if (e.key === 'ArrowRight') cmd = typing ? null : 'right'
      else if (e.key === 'Enter') cmd = typing ? null : 'confirm'
      else if (e.key === 'Backspace' || e.key === 'Escape') cmd = typing ? null : 'cancel'
      if (!cmd) return
      e.preventDefault()
      dispatchCommand(cmd)
    }
    window.addEventListener('keydown', onKey)

    return () => {
      stop()
      clearInterval(id)
      window.removeEventListener('keydown', onKey)
    }
  })
</script>

{@render children()}
<MimicControls />
