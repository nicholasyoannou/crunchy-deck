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
    // safety: never hang on a missing/blocked video
    const t = setTimeout(finishVideo, 6000)
    return () => clearTimeout(t)
  })

  // navigate once the animation has played AND we know where to go
  $effect(() => {
    if (videoDone && target) goto(target)
  })
</script>

<div class="grid h-screen place-items-center bg-surface">
  <div class="flex flex-col items-center gap-6">
    <!-- bundled, plays instantly; load happens in the background while it animates -->
    <video
      src="/CRLogoIntro.mp4"
      autoplay
      muted
      playsinline
      onended={finishVideo}
      onerror={finishVideo}
      class="w-[440px] max-w-[70vw]"
    ></video>
    {#if showSpinner}
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-brand"></div>
    {/if}
  </div>
</div>
