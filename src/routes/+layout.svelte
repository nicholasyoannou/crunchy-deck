<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { startGamepadPoller } from '$lib/input/poller'
  import { ensureFocus, moveFocus } from '$lib/input/navigate'

  let { children } = $props()

  onMount(() => {
    const stop = startGamepadPoller((cmd) => {
      if (cmd === 'cancel') history.back()
    })
    const id = setInterval(ensureFocus, 500)

    // keyboard fallback so every input path is testable without a controller
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') moveFocus('up')
      else if (e.key === 'ArrowDown') moveFocus('down')
      else if (e.key === 'ArrowLeft') moveFocus('left')
      else if (e.key === 'ArrowRight') moveFocus('right')
      else return
      e.preventDefault()
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
