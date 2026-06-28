<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { authGuard } from '$lib/api/guard'
  import { prefs } from '$lib/api/prefsStore'
  import { resolveQualityHeight } from '$lib/playback/quality'
  import shaka from 'shaka-player/dist/shaka-player.compiled.js'

  type Stream = {
    accessToken: string
    contentId: string
    assetId?: string
    videoToken: string
    manifestUrl: string
    audioLocale?: string
    hardSubs: Record<string, { url: string }>
    versions: { audio_locale: string; guid: string; original?: boolean }[]
    meta: {
      title: string
      seriesTitle: string
      seasonNumber: number | null
      episodeNumber: number | null
      durationMs: number | null
      maturityRating: string | null
      maturitySystem: string | null
      descriptors: string[]
    }
  }

  const routeId = $derived($page.params.id ?? '')
  let video: HTMLVideoElement
  let player: any = null

  let status: 'loading' | 'playing' | 'error' = $state('loading')
  let errorMsg = $state('')
  let s = $state<Stream | null>(null)

  // playback state
  let paused = $state(false)
  let cur = $state(0)
  let dur = $state(0)
  let buffered = $state(0)
  let buffering = $state(true)

  // responsive seeking: scrubbing updates the bar instantly; the real seek is committed (debounced)
  let scrubbing = $state(false)
  let scrubTime = $state(0)
  let seekTimer: ReturnType<typeof setTimeout> | null = null

  // chrome
  let overlay = $state(true)
  let overlayTimer: ReturnType<typeof setTimeout> | null = null
  let showRating = $state(false)
  let menu: 'none' | 'audio' | 'subtitle' | 'quality' = $state('none')

  // tracks
  let audioGuid = $state('') // guid of the currently-loaded audio version
  let curSub = $state('off')
  let qualities: number[] = $state([])
  let curQuality: number | 'auto' = $state('auto')
  let releaseTimer: ReturnType<typeof setTimeout> | null = null

  // in-flight seek: hold the scrubber at the chosen position until the video reports 'seeked'
  let seeking = $state(false)
  let seekTarget = $state(0)

  // skip-intro / next-episode (markers in seconds; next = the following episode or null)
  let markers = $state<{ intro: SkipBlock | null; credits: SkipBlock | null; recap: SkipBlock | null; preview: SkipBlock | null } | null>(null)
  let next = $state<NextEpisode | null>(null)
  let skipShown = false
  let nextShown = false

  // route-driven episode loading (so "Next episode" + Back re-load without a remount)
  let ready = $state(false)
  let loadedId = ''

  const LICENSE = 'https://cr-license-proxy.prd.crunchyrollsvc.com/v1/license/widevine'
  const CERT =
    'CrsCCAMSEKDc0WAwLAQT1SB2ogyBJEwYv4Tx7gUijgIwggEKAoIBAQC8Xc/GTRwZDtlnBThq8V382D1oJAM0F/YgCQtNDLz7vTWJ+QskNGi5Dd2qzO4s48Cnx5BLvL4H0xCRSw2Ed6ekHSdrRUwyoYOE+M/t1oIbccwlTQ7o+BpV1X6TB7fxFyx1jsBtRsBWphU65w121zqmSiwzZzJ4xsXVQCJpQnNI61gzHO42XZOMuxytMm0F6puNHTTqhyY3Z290YqvSDdOB+UY5QJuXJgjhvOUD9+oaLlvT+vwmV2/NJWxKqHBKdL9JqvOnNiQUF0hDI7Wf8Wb63RYSXKE27Ky31hKgx1wuq7TTWkA+kHnJTUrTEfQxfPR4dJTquE+IDLAi5yeVVxzbAgMBAAE6DGNhc3RsYWJzLmNvbUABEoADMmGXpXg/0qxUuwokpsqVIHZrJfu62ar+BF8UVUKdK5oYQoiTZd9OzK3kr29kqGGk3lSgM0/p499p/FUL8oHHzgsJ7Hajdsyzn0Vs3+VysAgaJAkXZ+k+N6Ka0WBiZlCtcunVJDiHQbz1sF9GvcePUUi2fM/h7hyskG5ZLAyJMzTvgnV3D8/I5Y6mCFBPb/+/Ri+9bEvquPF3Ff9ip3yEHu9mcQeEYCeGe9zR/27eI5MATX39gYtCnn7dDXVxo4/rCYK0A4VemC3HRai2X3pSGcsKY7+6we7h4IycjqtuGtYg8AbaigovcoURAZcr1d/G0rpREjLdVLG0Gjqk63Gx688W5gh3TKemsK3R1jV0dOfj3e6uV/kTpsNRL9KsD0v7ysBQVdUXEbJotcFz71tI5qc3jwr6GjYIPA3VzusD17PN6AGQniMwxJV12z/EgnUopcFB13osydpD2AaDsgWo5RWJcNf+fzCgtUQx/0Au9+xVm5LQBdv8Ja4f2oiHN3dw'

  function b64ToU8(b64: string): Uint8Array {
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return arr
  }
  function fmt(t: number): string {
    if (!t || !isFinite(t)) return '0:00'
    const h = Math.floor(t / 3600)
    const m = Math.floor((t % 3600) / 60)
    const sec = Math.floor(t % 60)
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
      : `${m}:${sec.toString().padStart(2, '0')}`
  }

  // ---- chrome show/hide --------------------------------------------------
  function showOverlay() {
    overlay = true
    if (overlayTimer) clearTimeout(overlayTimer)
    // use the LIVE video state (the reactive `paused` lags a tick behind a tap, which left the
    // controls stuck on screen after unpausing); only auto-hide while actually playing.
    if (menu === 'none' && video && !video.paused) overlayTimer = setTimeout(() => (overlay = false), 3500)
  }

  // ---- transport ---------------------------------------------------------
  function togglePlay() {
    if (!video) return
    if (video.paused) video.play()
    else video.pause()
    showOverlay()
  }
  function skip(delta: number) {
    if (!dur) return
    if (!scrubbing) scrubTime = cur
    scrubbing = true
    scrubTime = Math.max(0, Math.min(dur, scrubTime + delta))
    showOverlay()
    if (seekTimer) clearTimeout(seekTimer)
    seekTimer = setTimeout(commitSeek, 280) // one real seek after the burst of skips settles
  }
  function commitSeek() {
    if (!video) {
      scrubbing = false
      return
    }
    // record the target + mark an in-flight seek so the thumb stays put while the region buffers
    seekTarget = scrubTime
    seeking = true
    video.currentTime = scrubTime
    scrubbing = false
  }
  // pointer (touch/mouse) scrubbing on the bar
  let bar: HTMLElement
  let suppressClick = false
  function barTime(e: PointerEvent): number {
    const r = bar.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur
  }
  function onBarDown(e: PointerEvent) {
    if (!dur) return
    bar.setPointerCapture(e.pointerId)
    scrubbing = true
    scrubTime = barTime(e)
    showOverlay()
  }
  function onBarMove(e: PointerEvent) {
    if (!scrubbing) return
    scrubTime = barTime(e)
    showOverlay()
  }
  function onBarUp() {
    if (!scrubbing) return
    commitSeek()
    suppressClick = true
    setTimeout(() => (suppressClick = false), 60)
  }
  function onBarClick() {
    if (suppressClick) return // a pointer-drag already seeked
    togglePlay() // controller A / keyboard Enter on the bar
  }

  function back() {
    history.back()
  }

  // ---- age rating intro --------------------------------------------------
  function playRatingIntro() {
    if (!s?.meta.maturityRating) return
    showRating = true
    setTimeout(() => (showRating = false), 3600)
  }

  // ---- track switching (audio + subs reload; quality is in-player) --------
  async function doLoad(guid: string, sub: string, atTime: number, initial: boolean) {
    if (initial && s) releaseNow() // free the previous episode's stream slot before opening a new one
    if (initial) {
      markers = null
      next = null
    }
    buffering = true
    const res = await window.cr.player.stream(guid)
    if (!res.ok) {
      if (authGuard(res)) return
      status = 'error'
      errorMsg = res.error
      buffering = false
      return
    }
    s = res.data
    audioGuid = guid
    // First load of an episode: honour the profile's language prefs. Audio = the version whose locale
    // matches (re-resolve that guid if it isn't the one we opened); subtitle = the preferred soft-sub
    // when this stream offers it, else stay off. Manual audio/sub switches pass initial=false and skip this.
    if (initial) {
      const p = get(prefs)
      if (p?.audioLanguage) {
        const v = s.versions.find((x) => x.audio_locale === p.audioLanguage)
        if (v && v.guid !== guid) return doLoad(v.guid, sub, atTime, true)
      }
      if (p?.subtitleLanguage && s.hardSubs[p.subtitleLanguage]) sub = p.subtitleLanguage
    }
    curSub = sub
    const manifest = sub !== 'off' && s.hardSubs[sub]?.url ? s.hardSubs[sub].url : s.manifestUrl
    try {
      await player.load(manifest, atTime > 0 ? atTime : undefined)
    } catch (e: any) {
      const d = e?.detail
      const m = d ? `Shaka ${d.category}.${d.code} :: ${JSON.stringify(d.data ?? [])}` : 'Load failed: ' + (e?.code ?? e)
      window.cr.log?.(m)
      status = 'error'
      errorMsg = m.slice(0, 220)
      releaseNow()
      return
    }
    refreshQualities()
    applyQualityForLoad(initial) // honour the default-quality pref (auto = ABR)
    scheduleRelease()
    status = 'playing'
    buffering = false
    if (initial) {
      // skip markers + next episode for this episode (non-blocking; missing = none)
      Promise.all([window.cr.player.markers(guid), window.cr.player.nextEpisode(guid)]).then(([mk, nx]) => {
        if (mk.ok) markers = mk.data
        if (nx.ok) next = nx.data
      })
      playRatingIntro()
    }
    showOverlay()
    if (initial) focusEl('pl-play') // start on Play, not the back button
    try {
      await video.play()
    } catch {
      /* autoplay may require a gesture; the play button handles it */
    }
  }

  let menuOpener = ''
  function focusEl(id: string) {
    requestAnimationFrame(() => document.getElementById(id)?.focus())
  }
  function openMenu(m: 'audio' | 'subtitle' | 'quality') {
    if (menu === m) return closeMenu()
    menuOpener = m === 'audio' ? 'pl-audio' : m === 'subtitle' ? 'pl-subs' : 'pl-quality'
    menu = m // an $effect (below) moves focus into the panel
  }
  function closeMenu() {
    menu = 'none'
    focusEl(menuOpener || 'pl-play')
  }
  async function chooseAudio(v: { guid: string; audio_locale: string }) {
    if (v.guid === audioGuid) return closeMenu()
    menu = 'none'
    await doLoad(v.guid, curSub, video?.currentTime ?? 0, false)
    focusEl('pl-play')
  }
  async function chooseSub(loc: string) {
    if (loc === curSub) return closeMenu()
    menu = 'none'
    await doLoad(audioGuid, loc, video?.currentTime ?? 0, false)
    focusEl('pl-play')
  }
  function refreshQualities() {
    try {
      const v = player.getVariantTracks() as any[]
      qualities = [...new Set(v.map((t) => t.height).filter((h): h is number => !!h))].sort((a, b) => b - a)
    } catch {
      qualities = []
    }
  }
  // On a fresh episode, set the target from the default-quality pref; on audio/sub reloads keep the
  // current selection. Then apply it — ABR for auto, else lock the matching variant.
  function applyQualityForLoad(initial: boolean) {
    if (initial) {
      const h = resolveQualityHeight(qualities)
      curQuality = h == null ? 'auto' : h
    }
    if (curQuality === 'auto') {
      player.configure('abr.enabled', true)
    } else {
      player.configure('abr.enabled', false)
      const t = (player.getVariantTracks() as any[]).find((v) => v.height === curQuality)
      if (t) player.selectVariantTrack(t, true)
    }
  }
  function chooseQuality(h: number | 'auto') {
    curQuality = h
    if (h === 'auto') player.configure('abr.enabled', true)
    else {
      player.configure('abr.enabled', false)
      const t = (player.getVariantTracks() as any[]).find((v) => v.height === h)
      if (t) player.selectVariantTrack(t, true)
    }
    closeMenu()
  }

  const subLocales = $derived(s ? Object.keys(s.hardSubs) : [])
  const ratingText = $derived(s?.meta.maturityRating ?? '')

  // Deterministic Left/Right chain across the control row (audio/subs are conditional, so the cone
  // can't be trusted across the wide gap). Each button reads its neighbour from this list.
  const rowIds = $derived([
    'pl-play',
    'pl-back10',
    'pl-fwd10',
    ...(s && s.versions.length > 1 ? ['pl-audio'] : []),
    ...(subLocales.length ? ['pl-subs'] : []),
    'pl-quality'
  ])
  const navL = (id: string) => {
    const i = rowIds.indexOf(id)
    return i > 0 ? `#${rowIds[i - 1]}` : undefined
  }
  const navR = (id: string) => {
    const i = rowIds.indexOf(id)
    return i >= 0 && i < rowIds.length - 1 ? `#${rowIds[i + 1]}` : undefined
  }

  // ---- token slot release (the play token is only needed for the license) -
  function scheduleRelease() {
    if (releaseTimer) clearTimeout(releaseTimer)
    const tok = s?.videoToken
    const cid = s?.contentId
    releaseTimer = setTimeout(() => {
      if (tok && cid) window.cr.player.release(cid, tok)
    }, 3000)
  }
  function releaseNow() {
    if (releaseTimer) clearTimeout(releaseTimer)
    if (s?.videoToken && s?.contentId) window.cr.player.release(s.contentId, s.videoToken)
  }

  // Progress sync: push the playhead (seconds) to CR periodically + on pause/exit, like the official
  // apps, so Continue Watching / resume points stay current across devices.
  let syncTimer: ReturnType<typeof setInterval> | null = null
  function syncProgress() {
    if (s && video && video.currentTime > 1) window.cr.player.setPlayhead(s.contentId, video.currentTime)
  }

  onMount(async () => {
    if (!window.cr) {
      status = 'error'
      errorMsg = 'Preload bridge unavailable.'
      return
    }
    shaka.polyfill.installAll()
    if (!shaka.Player.isBrowserSupported()) {
      status = 'error'
      errorMsg = 'Browser/CDM unsupported.'
      return
    }
    player = new shaka.Player()
    // configure() MUST run before attach() — Shaka reads serverCertificate during attach()'s DRM
    // init; setting it after is ignored, so the CDM builds a CLEAR challenge CR rejects.
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
    await player.attach(video)

    const net = player.getNetworkingEngine()
    net.registerRequestFilter((type: any, req: any) => {
      const uri: string = req.uris?.[0] ?? ''
      if (!uri.includes('crunchyrollcdn.com')) req.headers['Authorization'] = 'Bearer ' + (s?.accessToken ?? '')
      if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
        req.headers['X-Cr-Content-Id'] = s?.contentId
        req.headers['X-Cr-Video-Token'] = s?.videoToken
        req.headers['Content-Type'] = 'application/octet-stream'
      }
    })
    net.registerResponseFilter((type: any, res: any) => {
      if (type !== shaka.net.NetworkingEngine.RequestType.LICENSE) return
      try {
        const txt = new TextDecoder('utf-8').decode(new Uint8Array(res.data))
        const obj = JSON.parse(txt)
        if (obj && obj.license) res.data = b64ToU8(obj.license).buffer
      } catch {
        /* raw license bytes */
      }
    })
    player.addEventListener('buffering', (e: any) => (buffering = e.buffering))
    player.addEventListener('error', (e: any) => {
      const d = e.detail
      const m = d ? `Shaka ${d.category}.${d.code} :: ${JSON.stringify(d.data ?? [])}` : 'unknown'
      window.cr.log?.(m)
      if (status !== 'playing') {
        status = 'error'
        errorMsg = m.slice(0, 220)
      }
    })

    ready = true // the $effect below loads the current episode (and re-loads it on Next / Back)
    syncTimer = setInterval(() => {
      if (video && !video.paused) syncProgress()
    }, 30000)
  })

  // Load whenever the route's episode id changes — initial mount, "Next episode", and Back all flow here.
  $effect(() => {
    const id = routeId
    if (!ready || !id || id === loadedId) return
    loadedId = id
    const t = Number($page.url.searchParams.get('t') || 0)
    doLoad(id, 'off', t, true)
  })

  // ---- skip intro/recap + next episode -----------------------------------
  const skipBlock = $derived(
    markers?.intro && cur >= markers.intro.start && cur < markers.intro.end - 0.3
      ? markers.intro
      : markers?.recap && cur >= markers.recap.start && cur < markers.recap.end - 0.3
        ? markers.recap
        : null
  )
  const skipLabel = $derived(skipBlock?.type === 'recap' ? 'Skip Recap' : 'Skip Intro')
  const showNext = $derived(
    !!next &&
      ((!!markers?.credits && cur >= markers.credits.start) || (!markers?.credits && dur > 0 && cur >= dur - 20))
  )
  function skipMarker() {
    if (!video || !skipBlock) return
    seekTarget = skipBlock.end
    seeking = true
    video.currentTime = skipBlock.end
    showOverlay()
    focusEl('pl-play')
  }
  async function playNext() {
    if (!next) return
    syncProgress()
    goto(`/watch/${next.id}`, { replaceState: true }) // the $effect reloads; replace so Back skips the finished ep
  }
  // auto-focus the Skip / Next button when it first appears, so a controller user just presses A
  $effect(() => {
    if (!!skipBlock && !skipShown && menu === 'none') {
      skipShown = true
      focusEl('pl-skip')
    }
    if (!skipBlock) skipShown = false
  })
  $effect(() => {
    if (showNext && !nextShown && menu === 'none') {
      nextShown = true
      focusEl('pl-next')
    }
    if (!showNext) nextShown = false
  })

  onDestroy(() => {
    if (overlayTimer) clearTimeout(overlayTimer)
    if (seekTimer) clearTimeout(seekTimer)
    if (syncTimer) clearInterval(syncTimer)
    syncProgress() // final progress push on back/exit
    releaseNow()
    player?.destroy()
  })

  // controller Left/Right (routed here by the input dispatcher when the bar is focused), and B/cancel
  // closing an open settings panel (routed via the dispatcher so it doesn't also exit the player).
  function onSeekEvent(e: Event) {
    skip((e as CustomEvent).detail as number)
  }
  function onCloseMenu() {
    if (menu !== 'none') closeMenu()
  }
  onMount(() => {
    window.addEventListener('cr:seek', onSeekEvent)
    window.addEventListener('cr:closemenu', onCloseMenu)
    return () => {
      window.removeEventListener('cr:seek', onSeekEvent)
      window.removeEventListener('cr:closemenu', onCloseMenu)
    }
  })

  // move focus into the settings panel when it opens
  $effect(() => {
    if (menu !== 'none') {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#pl-menu [data-focusable]')?.focus())
    }
  })

  function onKey(e: KeyboardEvent) {
    if (e.key === ' ') {
      e.preventDefault()
      togglePlay()
    } else {
      showOverlay()
    }
  }

  // active drag > in-flight seek (held at target) > live playhead
  const shownTime = $derived(scrubbing ? scrubTime : seeking ? seekTarget : cur)
  const progressPct = $derived(dur ? (shownTime / dur) * 100 : 0)
  const bufferedPct = $derived(dur ? (buffered / dur) * 100 : 0)
  const epLine = $derived(
    s
      ? [s.meta.seasonNumber ? `S${s.meta.seasonNumber}` : '', s.meta.episodeNumber ? `E${s.meta.episodeNumber}` : '']
          .filter(Boolean)
          .join(' ')
      : ''
  )
</script>

<!-- no onmousemove: gamescope delivers touch as a mouse, so pressing the Steam button (overlay cursor
     jiggle) would otherwise pop the player chrome. Controls show on tap / D-pad / keypress instead. -->
<svelte:window onkeydown={onKey} />

<div class="relative h-screen w-screen overflow-hidden bg-black">
  <!-- svelte-ignore a11y_media_has_caption -->
  <video
    bind:this={video}
    class="h-full w-full"
    ontimeupdate={() => {
      // while a seek is in flight, ignore the stale playhead so the thumb doesn't snap back;
      // release the hold once the playhead actually reaches the target (covers a missing 'seeked')
      if (seeking) {
        if (Math.abs(video.currentTime - seekTarget) < 0.5) seeking = false
        else return
      }
      cur = video.currentTime
      dur = video.duration || dur
    }}
    onseeking={() => {
      seeking = true
      buffering = true
    }}
    onseeked={() => {
      seeking = false
      buffering = false
      cur = video.currentTime
    }}
    onprogress={() => {
      try {
        const b = video.buffered
        for (let i = 0; i < b.length; i++)
          if (b.start(i) <= cur && cur <= b.end(i) + 0.5) {
            buffered = b.end(i)
            break
          }
      } catch {
        /* ignore */
      }
    }}
    onplay={() => {
      paused = false
      showOverlay() // restart the auto-hide timer once playback actually resumes
    }}
    onpause={() => {
      paused = true
      syncProgress()
    }}
    onwaiting={() => (buffering = true)}
    onplaying={() => (buffering = false)}
  ></video>

  <!-- tap anywhere on the picture toggles play/pause + reveals controls (sits BELOW the chrome, so
       only the actual buttons act; a tap on the empty top bar no longer triggers Back) -->
  <button
    type="button"
    tabindex="-1"
    aria-label={paused ? 'Play' : 'Pause'}
    onclick={togglePlay}
    class="absolute inset-0 z-0 h-full w-full cursor-default bg-transparent outline-none"
  ></button>

  <!-- age-rating intro (fades in then out, like the CR TV app) -->
  {#if ratingText}
    <div
      class="pointer-events-none absolute right-10 top-8 z-10 flex items-center gap-3 transition-opacity duration-700 ease-out"
      style="opacity:{showRating ? 1 : 0}"
    >
      <div class="text-right text-sm text-white/70">
        <div class="font-semibold uppercase tracking-wide text-white/90">Rating</div>
        {#if s?.meta.descriptors?.length}<div>{s.meta.descriptors.join(' · ')}</div>{/if}
      </div>
      <div class="grid h-12 min-w-12 place-items-center rounded-md border-2 border-white/80 px-2 text-2xl font-black text-white">
        {ratingText}
      </div>
    </div>
  {/if}

  <!-- buffering / loading spinner -->
  {#if (buffering || status === 'loading') && status !== 'error'}
    <div class="pointer-events-none absolute inset-0 grid place-items-center">
      <div class="h-14 w-14 animate-spin rounded-full border-[3px] border-white/15 border-t-brand"></div>
    </div>
  {/if}

  {#if status === 'error'}
    <div class="absolute inset-0 grid place-items-center text-center">
      <div>
        <p class="mb-2 font-bold text-brand">Playback error</p>
        <p class="mx-auto max-w-md break-words text-sm text-white/50">{errorMsg}</p>
        <button
          data-focusable
          onclick={back}
          class="mt-4 rounded bg-brand px-5 py-2 font-bold text-black outline-none select:ring-4 select:ring-white/40"
        >Go back</button>
      </div>
    </div>
  {/if}

  <!-- top + bottom chrome (kept in the DOM so controller focus persists; just faded) -->
  <div
    class="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between transition-opacity duration-300"
    style="opacity:{overlay || menu !== 'none' ? 1 : 0}"
    inert={menu !== 'none'}
  >
    <!-- top bar — only Back is interactive; taps on the empty bar pass through to the play toggle -->
    <div class="flex items-start gap-4 bg-gradient-to-b from-black/80 to-transparent p-6 pb-12">
      <button
        id="pl-back"
        data-focusable
        data-down="#pl-seek"
        onclick={back}
        class:pointer-events-auto={overlay || menu !== 'none'}
        class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/40 text-xl text-white outline-none transition select:bg-brand select:text-black"
        aria-label="Back">‹</button
      >
      <div class="min-w-0 pt-0.5">
        <div class="truncate text-xl font-black drop-shadow">{s?.meta.seriesTitle || ''}</div>
        <div class="truncate text-sm text-white/70">
          {#if epLine}<span class="font-semibold text-brand">{epLine}</span><span class="px-1.5 text-white/40">·</span>{/if}{s?.meta.title || ''}
        </div>
      </div>
    </div>

    <!-- bottom control bar -->
    <div
      class="bg-gradient-to-t from-black/90 via-black/60 to-transparent px-8 pb-6 pt-16"
      class:pointer-events-auto={overlay || menu !== 'none'}
    >
      <!-- scrub bar -->
      <div class="mb-3 flex items-center gap-3">
        <span class="w-16 text-right font-mono text-xs text-white/80">{fmt(shownTime)}</span>
        <div
          id="pl-seek"
          bind:this={bar}
          data-focusable
          data-focus-self
          data-player-seek
          data-up="#pl-back"
          data-down="#pl-play"
          role="slider"
          aria-label="Seek"
          aria-valuemin="0"
          aria-valuemax={Math.floor(dur)}
          aria-valuenow={Math.floor(shownTime)}
          tabindex="0"
          onpointerdown={onBarDown}
          onpointermove={onBarMove}
          onpointerup={onBarUp}
          onclick={onBarClick}
          class="group relative h-8 grow cursor-pointer outline-none"
        >
          <div class="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 transition-all group-select:h-2.5">
            <div class="absolute inset-y-0 left-0 bg-white/30" style="width:{bufferedPct}%"></div>
            <div class="absolute inset-y-0 left-0 bg-brand" style="width:{progressPct}%"></div>
          </div>
          <div
            class="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand opacity-0 shadow transition-opacity group-select:opacity-100"
            style="left:{progressPct}%"
          ></div>
        </div>
        <span class="w-16 font-mono text-xs text-white/60">{fmt(dur)}</span>
      </div>

      <!-- buttons -->
      <div class="flex items-center gap-2">
        <button
          id="pl-play"
          data-focusable
          data-focus-self
          data-up="#pl-seek"
          data-left={navL('pl-play')}
          data-right={navR('pl-play')}
          onclick={togglePlay}
          class="grid h-12 w-12 place-items-center rounded-full text-white outline-none transition select:bg-brand select:text-black"
          aria-label={paused ? 'Play' : 'Pause'}
        >
          {#if paused}
            <svg viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M8 5v14l11-7z" /></svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="currentColor" class="h-6 w-6"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          {/if}
        </button
        >
        <button
          id="pl-back10"
          data-focusable
          data-up="#pl-seek"
          data-left={navL('pl-back10')}
          data-right={navR('pl-back10')}
          onclick={() => skip(-10)}
          class="grid h-11 w-11 place-items-center rounded-full text-lg text-white/90 outline-none transition select:bg-white/20"
          aria-label="Back 10 seconds">⟲</button
        >
        <button
          id="pl-fwd10"
          data-focusable
          data-up="#pl-seek"
          data-left={navL('pl-fwd10')}
          data-right={navR('pl-fwd10')}
          onclick={() => skip(10)}
          class="grid h-11 w-11 place-items-center rounded-full text-lg text-white/90 outline-none transition select:bg-white/20"
          aria-label="Forward 10 seconds">⟳</button
        >

        <div class="grow"></div>

        {#if s && s.versions.length > 1}
          <button
            id="pl-audio"
            data-focusable
            data-up="#pl-seek"
            data-left={navL('pl-audio')}
            data-right={navR('pl-audio')}
            onclick={() => openMenu('audio')}
            class="rounded-md px-3 py-2 text-sm font-semibold text-white/90 outline-none transition select:bg-white/20"
            >Audio</button
          >
        {/if}
        {#if s && subLocales.length}
          <button
            id="pl-subs"
            data-focusable
            data-up="#pl-seek"
            data-left={navL('pl-subs')}
            data-right={navR('pl-subs')}
            onclick={() => openMenu('subtitle')}
            class="rounded-md px-3 py-2 text-sm font-semibold text-white/90 outline-none transition select:bg-white/20"
            >Subtitles</button
          >
        {/if}
        <button
          id="pl-quality"
          data-focusable
          data-up="#pl-seek"
          data-left={navL('pl-quality')}
          onclick={() => openMenu('quality')}
          class="grid h-11 w-11 place-items-center rounded-full text-xl text-white/90 outline-none transition select:bg-white/20"
          aria-label="Quality">⚙</button
        >
      </div>
    </div>
  </div>

  <!-- skip intro/recap — floating, appears during the marker even with the controls hidden -->
  {#if skipBlock}
    <button
      id="pl-skip"
      data-focusable
      data-down="#pl-play"
      onclick={skipMarker}
      class="absolute bottom-28 right-8 z-30 rounded-md bg-white/90 px-5 py-2.5 text-sm font-black text-black shadow-lg outline-none transition select:bg-brand select:ring-4 select:ring-white/40"
      >{skipLabel} ⟩⟩</button
    >
  {/if}

  <!-- next episode — floating, appears at the credits / last 20s -->
  {#if showNext && next}
    <button
      id="pl-next"
      data-focusable
      data-down="#pl-play"
      onclick={playNext}
      class="absolute bottom-28 right-8 z-30 flex items-center gap-3 rounded-lg bg-surface-1/95 p-3 pr-5 text-left shadow-2xl outline-none ring-1 ring-white/10 backdrop-blur transition select:ring-4 select:ring-brand"
    >
      {#if next.thumbnail}<img src={next.thumbnail} alt="" class="h-12 w-20 rounded object-cover" />{/if}
      <div class="min-w-0">
        <div class="text-xs font-semibold uppercase tracking-wide text-white/50">Next episode ⟩⟩</div>
        <div class="line-clamp-1 text-sm font-bold text-white">
          {#if next.episodeNumber}E{next.episodeNumber} · {/if}{next.title}
        </div>
      </div>
    </button>
  {/if}

  <!-- settings panel (audio / subtitles / quality) -->
  {#if menu !== 'none' && s}
    <div id="pl-menu" class="absolute bottom-28 right-8 z-20 w-64 overflow-hidden rounded-card bg-surface-1/95 shadow-2xl ring-1 ring-white/10 backdrop-blur">
      <div class="border-b border-white/10 px-4 py-3 text-sm font-black uppercase tracking-wide text-white/80">
        {menu === 'audio' ? 'Audio' : menu === 'subtitle' ? 'Subtitles' : 'Quality'}
      </div>
      <div class="max-h-72 overflow-y-auto py-1">
        {#if menu === 'audio'}
          {#each s.versions as v, i}
            <button
              id={`pl-aud-${i}`}
              data-focusable
              onclick={() => chooseAudio(v)}
              class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm outline-none transition select:bg-white/15 {v.guid ===
              audioGuid
                ? 'font-bold text-brand'
                : 'text-white/85'}"
            >
              <span>{v.audio_locale}{v.original ? ' (Original)' : ''}</span>
              {#if v.guid === audioGuid}<span>✓</span>{/if}
            </button>
          {/each}
        {:else if menu === 'subtitle'}
          <button
            id="pl-sub-off"
            data-focusable
            data-focus-self
            onclick={() => chooseSub('off')}
            class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm outline-none transition select:bg-white/15 {curSub ===
            'off'
              ? 'font-bold text-brand'
              : 'text-white/85'}"
          >
            <span>Off</span>{#if curSub === 'off'}<span>✓</span>{/if}
          </button>
          {#each subLocales as loc, i}
            <button
              id={`pl-sub-${i}`}
              data-focusable
              onclick={() => chooseSub(loc)}
              class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm outline-none transition select:bg-white/15 {curSub ===
              loc
                ? 'font-bold text-brand'
                : 'text-white/85'}"
            >
              <span>{loc}</span>{#if curSub === loc}<span>✓</span>{/if}
            </button>
          {/each}
        {:else}
          <button
            id="pl-q-auto"
            data-focusable
            data-focus-self
            onclick={() => chooseQuality('auto')}
            class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm outline-none transition select:bg-white/15 {curQuality ===
            'auto'
              ? 'font-bold text-brand'
              : 'text-white/85'}"
          >
            <span>Auto</span>{#if curQuality === 'auto'}<span>✓</span>{/if}
          </button>
          {#each qualities as h}
            <button
              id={`pl-q-${h}`}
              data-focusable
              onclick={() => chooseQuality(h)}
              class="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm outline-none transition select:bg-white/15 {curQuality ===
              h
                ? 'font-bold text-brand'
                : 'text-white/85'}"
            >
              <span>{h}p</span>{#if curQuality === h}<span>✓</span>{/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
