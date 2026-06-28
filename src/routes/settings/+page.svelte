<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { clearHome, prefetchHome } from '$lib/api/homeStore'
  import { getSkipSeconds, setSkipSeconds, SKIP_OPTIONS } from '$lib/playback/skip'
  import { getDefaultQuality, setDefaultQuality, QUALITY_OPTIONS, type Quality } from '$lib/playback/quality'
  import {
    getSkipBackBtn,
    getSkipForwardBtn,
    setSkipBackBtn,
    setSkipForwardBtn,
    buttonName,
    armButtonCapture,
    cancelButtonCapture,
    DEFAULT_SKIP_BACK,
    DEFAULT_SKIP_FORWARD
  } from '$lib/input/bindings'
  import { prefs, loadPrefs, savePref } from '$lib/api/prefsStore'
  import { openPicker } from '$lib/ui/picker'
  import {
    pickerOptions,
    langLabel,
    AUDIO_LANGUAGES,
    SUBTITLE_LANGUAGES,
    DISPLAY_LANGUAGES,
    SUBTITLE_NONE
  } from '$lib/data/languages'
  import Icon from '$lib/ui/Icon.svelte'

  // --- playback: skip interval ---
  let skip = $state(3)
  function chooseSkip(n: number) {
    skip = n
    setSkipSeconds(n)
  }

  // --- playback: default quality ---
  let quality = $state<Quality>('auto')
  function chooseQuality(q: Quality) {
    quality = q
    setDefaultQuality(q)
  }

  // --- controls: rebindable skip buttons (press a gamepad button to capture it) ---
  let skipBackBtn = $state(DEFAULT_SKIP_BACK)
  let skipForwardBtn = $state(DEFAULT_SKIP_FORWARD)
  let capturing = $state<'back' | 'forward' | null>(null)
  let captureTimer: ReturnType<typeof setTimeout> | null = null
  function rebind(which: 'back' | 'forward') {
    cancelButtonCapture()
    if (captureTimer) clearTimeout(captureTimer)
    capturing = which
    armButtonCapture((index) => {
      if (which === 'back') {
        setSkipBackBtn(index)
        skipBackBtn = index
      } else {
        setSkipForwardBtn(index)
        skipForwardBtn = index
      }
      capturing = null
      if (captureTimer) clearTimeout(captureTimer)
    })
    captureTimer = setTimeout(() => {
      cancelButtonCapture()
      capturing = null
    }, 6000)
  }
  onDestroy(() => {
    cancelButtonCapture()
    if (captureTimer) clearTimeout(captureTimer)
  })

  let account = $state<{ account_id?: string; country?: string } | null>(null)
  let membership = $state<{ premium: boolean | null } | null>(null)
  let phase = $state<'loading' | 'ready' | 'error'>('loading')
  let error = $state('')
  let busy = $state(false)

  // --- account preferences (current profile, synced to CR) ---
  function pickDisplay() {
    const cur = $prefs?.displayLanguage ?? ''
    openPicker({
      title: 'Display language',
      options: pickerOptions(DISPLAY_LANGUAGES, cur),
      current: cur,
      onSelect: async (code) => {
        // savePref sets the app's content-metadata locale; drop + re-warm the cached home so its hero
        // and row titles ("Continue Watching", …) come back in the new language.
        if (await savePref({ displayLanguage: code })) {
          clearHome()
          prefetchHome()
        }
      }
    })
  }
  function pickAudio() {
    const cur = $prefs?.audioLanguage ?? ''
    openPicker({
      title: 'Audio language',
      options: pickerOptions(AUDIO_LANGUAGES, cur),
      current: cur,
      onSelect: (code) => savePref({ audioLanguage: code })
    })
  }
  function pickSubtitle() {
    const cur = $prefs?.subtitleLanguage ?? ''
    openPicker({
      title: 'Subtitle language',
      options: pickerOptions(SUBTITLE_LANGUAGES, cur, [SUBTITLE_NONE]),
      current: cur,
      onSelect: (code) => savePref({ subtitleLanguage: code })
    })
  }

  async function logout() {
    if (busy) return
    busy = true
    await window.cr.auth.logout()
    clearHome() // drop the signed-in user's cached home feed
    goto('/login')
  }

  // --- updates ---
  let upd = $state<UpdateState | null>(null)
  let checking = $state(false)
  let checkMsg = $state('')
  function relTime(ts: number | null | undefined) {
    if (!ts) return 'never'
    const sec = Math.floor((Date.now() - ts) / 1000)
    if (sec < 60) return 'just now'
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
    return `${Math.floor(sec / 86400)}d ago`
  }
  function resultMsg(r: { available: boolean; version?: string; error?: string }) {
    return r.error ? 'Check failed' : r.available ? `Update available — ${r.version}` : 'Up to date'
  }
  async function checkUpdates() {
    if (checking) return
    checking = true
    checkMsg = ''
    const r = await window.cr.update.check()
    upd = await window.cr.update.getState()
    checking = false
    checkMsg = resultMsg(r)
  }
  async function setChannel(ch: 'stable' | 'dev') {
    if (checking || upd?.channel === ch) return
    checking = true
    checkMsg = ''
    const r = await window.cr.update.setChannel(ch)
    upd = await window.cr.update.getState()
    checking = false
    checkMsg = resultMsg(r)
  }

  onMount(async () => {
    if (!window.cr) {
      phase = 'error'
      error = 'Preload bridge unavailable.'
      return
    }
    const s = await window.cr.auth.status()
    if (!s.ok || !s.data.authenticated) {
      goto('/login')
      return
    }
    account = { account_id: s.data.account_id, country: s.data.country }
    phase = 'ready'
    skip = getSkipSeconds()
    quality = getDefaultQuality()
    skipBackBtn = getSkipBackBtn()
    skipForwardBtn = getSkipForwardBtn()
    loadPrefs(true) // current profile's language + maturity prefs
    window.cr.account.membership().then((r: any) => (membership = r?.ok ? r.data : { premium: null }))
    upd = await window.cr.update.getState()
    window.cr.update.onState((st) => (upd = st))
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#app-content [data-focusable]')?.focus())
  })
</script>

<div class="h-screen overflow-y-auto px-10 py-8">
  <h1 class="mb-6 text-2xl font-black">Settings</h1>
  {#if phase === 'error'}
    <p class="text-sm text-white/50">{error}</p>
  {:else if phase === 'ready'}
    <div class="max-w-md space-y-6">
      <section>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">Account</h2>
        <div class="rounded-card bg-surface-1 p-4 text-sm">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-white/70">Membership</span>
            {#if membership?.premium === true}
              <span class="font-bold text-brand">Crunchyroll Premium</span>
            {:else if membership?.premium === false}
              <span class="font-bold text-white/80">Free</span>
            {:else}
              <span class="text-white/40">—</span>
            {/if}
          </div>
          <div class="flex items-center justify-between text-white/70">
            <span>Region</span><span class="text-white">{account?.country ?? '—'}</span>
          </div>
          <div class="mt-1 flex items-center justify-between text-white/70">
            <span>Account ID</span><span class="break-all text-white/40">{account?.account_id ?? '—'}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">Preferences</h2>
        <div class="divide-y divide-white/5 overflow-hidden rounded-card bg-surface-1">
          <button
            id="pref-display"
            data-focusable
            data-focus-self
            onclick={pickDisplay}
            class="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-bold outline-none transition select:bg-surface-2 select:shadow-[inset_0_0_0_1.5px_#F47521]">
            <span class="text-white/80">Display language</span>
            <span class="flex items-center gap-1.5 text-white/55">
              {langLabel(DISPLAY_LANGUAGES, $prefs?.displayLanguage ?? '', '—')}<Icon name="chevron-right" size={16} />
            </span>
          </button>
          <button
            id="pref-audio"
            data-focusable
            data-focus-self
            onclick={pickAudio}
            class="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-bold outline-none transition select:bg-surface-2 select:shadow-[inset_0_0_0_1.5px_#F47521]">
            <span class="text-white/80">Audio language</span>
            <span class="flex items-center gap-1.5 text-white/55">
              {langLabel(AUDIO_LANGUAGES, $prefs?.audioLanguage ?? '', '—')}<Icon name="chevron-right" size={16} />
            </span>
          </button>
          <button
            id="pref-subtitle"
            data-focusable
            data-focus-self
            onclick={pickSubtitle}
            class="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-bold outline-none transition select:bg-surface-2 select:shadow-[inset_0_0_0_1.5px_#F47521]">
            <span class="text-white/80">Subtitle language</span>
            <span class="flex items-center gap-1.5 text-white/55">
              {langLabel(SUBTITLE_LANGUAGES, $prefs?.subtitleLanguage ?? '', 'None')}<Icon name="chevron-right" size={16} />
            </span>
          </button>
        </div>
        <p class="mt-2 px-1 text-xs text-white/35">Applied to every video and synced to your Crunchyroll account.</p>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">Content restrictions</h2>
        <div class="divide-y divide-white/5 overflow-hidden rounded-card bg-surface-1">
          <button
            id="cr-mature"
            data-focusable
            data-focus-self
            onclick={() => savePref({ matureContent: !$prefs?.matureContent })}
            class="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-bold outline-none transition select:bg-surface-2 select:shadow-[inset_0_0_0_1.5px_#F47521]">
            <span class="min-w-0">
              <span class="block text-white/80">Mature content</span>
              <span class="block text-xs font-medium text-white/35">Show 17+ titles</span>
            </span>
            <span class="relative h-6 w-11 shrink-0 rounded-full transition-colors {$prefs?.matureContent ? 'bg-brand' : 'bg-surface-3'}">
              <span class="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all {$prefs?.matureContent ? 'left-[1.375rem]' : 'left-0.5'}"></span>
            </span>
          </button>
        </div>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">Playback</h2>
        <div class="space-y-4 rounded-card bg-surface-1 p-4 text-sm">
          <div>
            <div class="mb-2.5 text-white/70">
              Skip interval <span class="text-white/40">({buttonName(skipBackBtn)} / {buttonName(skipForwardBtn)})</span>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each SKIP_OPTIONS as n, i}
                <button
                  id={`skip-${i}`}
                  data-focusable
                  data-focus-self
                  onclick={() => chooseSkip(n)}
                  class="rounded px-3 py-2 font-bold outline-none transition select:ring-2 select:ring-brand {skip === n
                    ? 'bg-brand text-black'
                    : 'bg-surface-2 text-white/80'}">{n}s</button
                >
              {/each}
            </div>
          </div>
          <div>
            <div class="mb-2.5 text-white/70">Default quality</div>
            <div class="flex flex-wrap gap-2">
              {#each QUALITY_OPTIONS as q, i}
                <button
                  id={`quality-${i}`}
                  data-focusable
                  data-focus-self
                  onclick={() => chooseQuality(q.value)}
                  class="rounded px-3 py-2 font-bold outline-none transition select:ring-2 select:ring-brand {quality ===
                  q.value
                    ? 'bg-brand text-black'
                    : 'bg-surface-2 text-white/80'}">{q.label}</button
                >
              {/each}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">Controls</h2>
        <div class="divide-y divide-white/5 overflow-hidden rounded-card bg-surface-1">
          <button
            id="bind-back"
            data-focusable
            data-focus-self
            onclick={() => rebind('back')}
            class="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-bold outline-none transition select:bg-surface-2 select:shadow-[inset_0_0_0_1.5px_#F47521]">
            <span class="text-white/80">Skip back</span>
            <span class="font-bold {capturing === 'back' ? 'animate-pulse text-brand' : 'text-white/55'}"
              >{capturing === 'back' ? 'Press a button…' : buttonName(skipBackBtn)}</span>
          </button>
          <button
            id="bind-forward"
            data-focusable
            data-focus-self
            onclick={() => rebind('forward')}
            class="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-bold outline-none transition select:bg-surface-2 select:shadow-[inset_0_0_0_1.5px_#F47521]">
            <span class="text-white/80">Skip forward</span>
            <span class="font-bold {capturing === 'forward' ? 'animate-pulse text-brand' : 'text-white/55'}"
              >{capturing === 'forward' ? 'Press a button…' : buttonName(skipForwardBtn)}</span>
          </button>
        </div>
        <p class="mt-2 px-1 text-xs text-white/35">
          Select a row, then press the gamepad button to assign it. Move skip to L2 / R2 so the Steam + R1 screenshot
          chord stops skipping.
        </p>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">Updates</h2>
        <div class="rounded-card bg-surface-1 p-4 text-sm">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-white/70">Version</span>
            <span class="font-mono text-white">{upd?.currentVersion ?? '—'}</span>
          </div>
          <div class="mb-3">
            <div class="mb-1.5 text-white/70">Channel</div>
            <div class="flex gap-2">
              <button
                id="upd-stable"
                data-focusable
                data-focus-self
                disabled={checking}
                onclick={() => setChannel('stable')}
                class="flex-1 rounded px-3 py-2 text-sm font-bold outline-none transition select:ring-2 select:ring-brand disabled:opacity-60 {upd?.channel ===
                'stable'
                  ? 'bg-brand text-black'
                  : 'bg-surface-2 text-white/80'}">Stable</button
              >
              <button
                id="upd-dev"
                data-focusable
                data-focus-self
                disabled={checking}
                onclick={() => setChannel('dev')}
                class="flex-1 rounded px-3 py-2 text-sm font-bold outline-none transition select:ring-2 select:ring-brand disabled:opacity-60 {upd?.channel ===
                'dev'
                  ? 'bg-brand text-black'
                  : 'bg-surface-2 text-white/80'}">Dev</button
              >
            </div>
          </div>
          <div class="mb-1 flex justify-between text-white/55">
            <span>Last checked</span><span class="text-white/80">{relTime(upd?.lastChecked)}</span>
          </div>
          <div class="mb-4 flex justify-between text-white/55">
            <span>Last updated</span>
            <span class="text-white/80">{upd?.lastUpdated ? `${upd.lastUpdated.version} · ${relTime(upd.lastUpdated.at)}` : 'never'}</span>
          </div>
          <button
            id="upd-check"
            data-focusable
            data-focus-self
            disabled={checking}
            onclick={checkUpdates}
            class="w-full rounded bg-surface-2 px-4 py-2.5 font-bold outline-none transition select:bg-brand select:text-black disabled:opacity-60"
            >{checking ? 'Checking…' : 'Check for updates'}</button
          >
          {#if checkMsg}<p class="mt-2 text-center text-xs text-white/60">{checkMsg}</p>{/if}
          {#if upd && !upd.packaged}<p class="mt-2 text-center text-xs text-white/35">Updates only apply to the packaged AppImage build.</p>{/if}
        </div>
      </section>

      <section class="space-y-3">
        <button
          id="set-profiles"
          data-focusable
          data-focus-self
          onclick={() => goto('/profiles')}
          class="w-full rounded-card bg-surface-2 px-4 py-3 text-left font-bold outline-none transition select:ring-2 select:ring-brand"
          >Switch profile</button
        >
        <button
          id="set-logout"
          data-focusable
          data-focus-self
          disabled={busy}
          onclick={logout}
          class="w-full rounded-card bg-surface-2 px-4 py-3 text-left font-bold text-brand outline-none transition select:bg-brand select:text-black disabled:opacity-60"
          >{busy ? 'Logging out…' : 'Log out'}</button
        >
      </section>
    </div>
  {/if}
</div>
