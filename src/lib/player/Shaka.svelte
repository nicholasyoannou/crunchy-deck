<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import shaka from 'shaka-player/dist/shaka-player.compiled.js'

  let { manifest, license }: { manifest: string; license: string } = $props()
  let video: HTMLVideoElement
  let player: any
  let status = $state('idle')

  onMount(async () => {
    shaka.polyfill.installAll()
    if (!shaka.Player.isBrowserSupported()) {
      status = 'browser unsupported'
      return
    }
    player = new shaka.Player()
    await player.attach(video)
    player.configure({
      drm: {
        servers: { 'com.widevine.alpha': license },
        advanced: {
          'com.widevine.alpha': {
            videoRobustness: 'SW_SECURE_CRYPTO',
            audioRobustness: 'SW_SECURE_CRYPTO'
          }
        }
      }
    })
    player.addEventListener('error', (e: any) => {
      status = 'error: ' + e.detail?.code
    })
    try {
      await player.load(manifest)
      status = 'playing'
      await video.play()
    } catch (e: any) {
      status = 'load failed: ' + (e?.code ?? e)
    }
  })

  onDestroy(() => player?.destroy())
</script>

<div class="flex flex-col gap-2">
  <video bind:this={video} controls class="w-[960px] max-w-full bg-black" data-status={status}></video>
  <p data-testid="shaka-status">status: {status}</p>
</div>
