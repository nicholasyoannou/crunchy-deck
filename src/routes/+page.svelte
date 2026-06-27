<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'

  let target: string | null = $state(null) // '/login' (authenticated users skip straight to /profiles)
  let videoDone = $state(false)
  let showVideo = $state(false) // only play the CR logo intro when we're NOT already logged in

  async function resolveTarget() {
    if (!window.cr) {
      target = '/login'
      showVideo = true
      return
    }
    try {
      const s = await window.cr.auth.status()
      if (s.ok && s.data.authenticated) {
        goto('/profiles') // already logged in -> skip the logo intro, go pick a profile
        return
      }
    } catch {
      /* fall through to login */
    }
    target = '/login'
    showVideo = true // logged out: play the intro, then go to login
  }

  function finishVideo() {
    videoDone = true
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

{#if showVideo}
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
  </div>
{:else}
  <!-- resolving auth (logged-in users land here for a beat, then route to /profiles) -->
  <div class="fixed inset-0 z-50 grid place-items-center bg-black">
    <div class="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-brand"></div>
  </div>
{/if}
