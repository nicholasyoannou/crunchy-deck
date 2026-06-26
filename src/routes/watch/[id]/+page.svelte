<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import shaka from 'shaka-player/dist/shaka-player.compiled.js'

  let id = $derived($page.params.id ?? '')
  let video: HTMLVideoElement
  let player: any = null
  let status: 'loading' | 'playing' | 'error' = $state('loading')
  let errorMsg = $state('')
  let paused = $state(false)
  let overlay = $state(true)
  let cur = $state(0)
  let dur = $state(0)
  let stream: { contentId: string; videoToken: string } | null = null
  let overlayTimer: ReturnType<typeof setTimeout> | null = null

  const LICENSE = 'https://cr-license-proxy.prd.crunchyrollsvc.com/v1/license/widevine'
  // castLabs Widevine service certificate (public; same one the base project uses).
  const CERT =
    'CrsCCAMSEKDc0WAwLAQT1SB2ogyBJEwYv4Tx7gUijgIwggEKAoIBAQC8Xc/GTRwZDtlnBThq8V382D1oJAM0F/YgCQtNDLz7vTWJ+QskNGi5Dd2qzO4s48Cnx5BLvL4H0xCRSw2Ed6ekHSdrRUwyoYOE+M/t1oIbccwlTQ7o+BpV1X6TB7fxFyx1jsBtRsBWphU65w121zqmSiwzZzJ4xsXVQCJpQnNI61gzHO42XZOMuxytMm0F6puNHTTqhyY3Z290YqvSDdOB+UY5QJuXJgjhvOUD9+oaLlvT+vwmV2/NJWxKqHBKdL9JqvOnNiQUF0hDI7Wf8Wb63RYSXKE27Ky31hKgx1wuq7TTWkA+kHnJTUrTEfQxfPR4dJTquE+IDLAi5yeVVxzbAgMBAAE6DGNhc3RsYWJzLmNvbUABEoADMmGXpXg/0qxUuwokpsqVIHZrJfu62ar+BF8UVUKdK5oYQoiTZd9OzK3kr29kqGGk3lSgM0/p499p/FUL8oHHzgsJ7Hajdsyzn0Vs3+VysAgaJAkXZ+k+N6Ka0WBiZlCtcunVJDiHQbz1sF9GvcePUUi2fM/h7hyskG5ZLAyJMzTvgnV3D8/I5Y6mCFBPb/+/Ri+9bEvquPF3Ff9ip3yEHu9mcQeEYCeGe9zR/27eI5MATX39gYtCnn7dDXVxo4/rCYK0A4VemC3HRai2X3pSGcsKY7+6we7h4IycjqtuGtYg8AbaigovcoURAZcr1d/G0rpREjLdVLG0Gjqk63Gx688W5gh3TKemsK3R1jV0dOfj3e6uV/kTpsNRL9KsD0v7ysBQVdUXEbJotcFz71tI5qc3jwr6GjYIPA3VzusD17PN6AGQniMwxJV12z/EgnUopcFB13osydpD2AaDsgWo5RWJcNf+fzCgtUQx/0Au9+xVm5LQBdv8Ja4f2oiHN3dw'

  function b64ToU8(b64: string): Uint8Array {
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return arr
  }

  function fmt(s: number): string {
    if (!s || !isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  function showOverlay() {
    overlay = true
    if (overlayTimer) clearTimeout(overlayTimer)
    overlayTimer = setTimeout(() => (overlay = false), 3000)
  }
  function toggle() {
    if (!video) return
    if (video.paused) video.play()
    else video.pause()
    showOverlay()
  }
  function seek(d: number) {
    if (video) video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + d))
    showOverlay()
  }

  onMount(async () => {
    if (!window.cr) {
      status = 'error'
      errorMsg = 'Preload bridge unavailable.'
      return
    }
    const res = await window.cr.player.stream(id)
    if (!res.ok) {
      status = 'error'
      errorMsg = res.error
      return
    }
    const s = res.data
    stream = { contentId: s.contentId, videoToken: s.videoToken }

    shaka.polyfill.installAll()
    if (!shaka.Player.isBrowserSupported()) {
      status = 'error'
      errorMsg = 'Browser/CDM unsupported.'
      return
    }
    player = new shaka.Player()
    await player.attach(video)
    player.configure({
      drm: {
        servers: { 'com.widevine.alpha': LICENSE },
        advanced: {
          'com.widevine.alpha': {
            serverCertificate: b64ToU8(CERT),
            videoRobustness: 'SW_SECURE_CRYPTO',
            audioRobustness: 'SW_SECURE_CRYPTO'
          }
        }
      }
    })

    const net = player.getNetworkingEngine()
    net.registerRequestFilter((type: any, request: any) => {
      request.headers['Authorization'] = 'Bearer ' + s.accessToken
      if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
        request.headers['X-Cr-Content-Id'] = s.contentId
        request.headers['X-Cr-Video-Token'] = s.videoToken
        request.headers['Content-Type'] = 'application/octet-stream'
      }
    })
    net.registerResponseFilter((type: any, response: any) => {
      // CR wraps the Widevine license as base64 inside a JSON body — unwrap it.
      if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
        const text = new TextDecoder('utf-8').decode(new Uint8Array(response.data))
        const obj = JSON.parse(text)
        response.data = b64ToU8(obj.license).buffer
      }
    })

    player.addEventListener('error', (e: any) => {
      status = 'error'
      errorMsg = 'Shaka error ' + (e.detail?.code ?? '')
    })

    try {
      await player.load(s.manifestUrl)
      status = 'playing'
      const t = Number($page.url.searchParams.get('t') || 0)
      if (t > 0) video.currentTime = t // resume point (seconds)
      await video.play()
      showOverlay()
    } catch (e: any) {
      status = 'error'
      errorMsg = 'Load failed: ' + (e?.code ?? e)
    }
  })

  onDestroy(() => {
    if (overlayTimer) clearTimeout(overlayTimer)
    player?.destroy()
    if (stream) window.cr.player.release(stream.contentId, stream.videoToken)
  })

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') seek(-10)
    else if (e.key === 'ArrowRight') seek(10)
    else if (e.key === ' ') toggle()
    else {
      showOverlay()
      return
    }
    e.preventDefault()
  }
</script>

<svelte:window onkeydown={onKey} onmousemove={showOverlay} />

<div class="relative h-screen w-screen overflow-hidden bg-black">
  <video
    bind:this={video}
    class="h-full w-full"
    ontimeupdate={() => {
      cur = video.currentTime
      dur = video.duration || 0
    }}
    onplay={() => (paused = false)}
    onpause={() => (paused = true)}
    onclick={toggle}
  ></video>

  {#if status === 'loading'}
    <div class="absolute inset-0 grid place-items-center">
      <div class="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-brand"></div>
    </div>
  {:else if status === 'error'}
    <div class="absolute inset-0 grid place-items-center text-center">
      <div>
        <p class="mb-2 font-bold text-brand">Playback error</p>
        <p class="max-w-md break-words text-sm text-white/50">{errorMsg}</p>
        <p class="mt-2 text-xs text-white/30">Press B / Backspace to go back.</p>
      </div>
    </div>
  {/if}

  {#if status === 'playing'}
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-8 transition-opacity duration-300"
      style="opacity:{overlay ? 1 : 0}"
    >
      <div class="mb-2 h-1.5 overflow-hidden rounded-full bg-white/25">
        <div class="h-full rounded-full bg-brand" style="width:{dur ? (cur / dur) * 100 : 0}%"></div>
      </div>
      <div class="flex items-center gap-4 text-sm text-white/80">
        <span class="text-2xl">{paused ? '▶' : '⏸'}</span>
        <span class="font-mono">{fmt(cur)} / {fmt(dur)}</span>
        <span class="text-xs text-white/40">space play/pause · ← / → seek 10s · B back</span>
      </div>
    </div>
  {/if}
</div>
