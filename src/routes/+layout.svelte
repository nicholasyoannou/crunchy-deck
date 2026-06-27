<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { startGamepadPoller } from '$lib/input/poller'
  import { startDragScroll } from '$lib/input/dragScroll'
  import { ensureFocus } from '$lib/input/navigate'
  import { dispatchCommand } from '$lib/input/commands'
  import { navOpen, exitOpen } from '$lib/nav/overlays'
  import NavMenu from '$lib/ui/NavMenu.svelte'
  import ExitConfirm from '$lib/ui/ExitConfirm.svelte'
  import UpdateBanner from '$lib/ui/UpdateBanner.svelte'

  let { children } = $props()

  onMount(() => {
    // App is up — fade out the static boot splash (in app.html) and drop it.
    const splash = document.getElementById('boot-splash')
    if (splash) {
      splash.style.opacity = '0'
      setTimeout(() => splash.remove(), 450)
    }

    const stop = startGamepadPoller()
    const stopDrag = startDragScroll() // touch/trackpad drag-to-scroll (gamescope delivers touch as mouse)
    const id = setInterval(ensureFocus, 500)

    const onSearch = () => goto('/search')
    window.addEventListener('cr:search', onSearch)

    // Steam Deck OSK bug: one key press commits a printable char TWICE (a 2nd insertion with no
    // keydown), so typing "i" yields "ii". Drop an identical insert that repeats within 50ms — far
    // faster than a human could re-press the same key, so a real double like "ll" still types.
    let lastInsert = { data: '', el: null as EventTarget | null, t: 0 }
    const onBeforeInput = (e: InputEvent) => {
      if (!e.inputType?.startsWith('insert') || !e.data) return
      const t = performance.now()
      if (e.data === lastInsert.data && e.target === lastInsert.el && t - lastInsert.t < 50) {
        e.preventDefault() // swallow the OSK's duplicate
        window.cr?.log(`[dedup] dropped "${e.data}"`)
        return
      }
      lastInsert = { data: e.data, el: e.target, t }
    }
    window.addEventListener('beforeinput', onBeforeInput, true)

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
      stopDrag()
      clearInterval(id)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('cr:search', onSearch)
      window.removeEventListener('beforeinput', onBeforeInput, true)
    }
  })
</script>

<div id="app-content" inert={$navOpen || $exitOpen}>
  {@render children()}
</div>
<NavMenu />
<ExitConfirm />
<UpdateBanner />
