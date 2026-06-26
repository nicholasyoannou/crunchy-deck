<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'

  let videoDone = $state(false)
  let target: string | null = $state(null) // '/home' | '/login'
  let showSpinner = $state(false)

  async function resolveTarget() {
    if (!window.cr) {
      target = '/login'
      return
    }
    try {
      const s = await window.cr.auth.status()
      target = s.ok && s.data.authenticated ? '/home' : '/login'
    } catch {
      target = '/login'
    }
  }

  function finishVideo() {
    videoDone = true
    if (!target) showSpinner = true
  }

  onMount(() => {
    resolveTarget()
    const t = setTimeout(finishVideo, 8000) // safety: never hang on a missing/blocked video
    return () => clearTimeout(t)
  })

  $effect(() => {
    if (videoDone && target) goto(target)
  })
</script>

<div class="fixed inset-0 z-50 bg-black">
  <!-- bundled, plays instantly + fullscreen; load happens in the background while it animates -->
  <video
    src="/CRLogoIntro.mp4"
    autoplay
    muted
    playsinline
    onended={finishVideo}
    onerror={finishVideo}
    class="h-full w-full object-cover"
  ></video>
  {#if showSpinner}
    <div class="absolute inset-x-0 bottom-16 flex justify-center">
      <div class="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-brand"></div>
    </div>
  {/if}
</div>
