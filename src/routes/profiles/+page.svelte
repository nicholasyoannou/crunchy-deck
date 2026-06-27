<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { prefetchHome, clearHome } from '$lib/api/homeStore'

  type Prof = {
    profile_id: string
    profile_name?: string
    username?: string
    avatar?: string
    wallpaper?: string
    is_selected?: boolean
  }

  let profiles = $state<Prof[]>([])
  let phase = $state<'loading' | 'ready' | 'error'>('loading')
  let error = $state('')
  let busy = $state(false)
  let activeIdx = $state(0) // which profile is focused — drives the full-screen wallpaper

  // CR serves profile avatars + wallpapers from fixed CDN paths (sizes confirmed against the TV app).
  const AVATAR = (a?: string) =>
    `https://static.crunchyroll.com/assets/avatar/170x170/${a || '0001-cr-white-orange.png'}`
  const WALLPAPER = (w?: string) =>
    w ? `https://static.crunchyroll.com/assets/wallpaper/1920x400/${w}` : null
  const label = (p: Prof) => p.profile_name || p.username || 'Profile'

  async function choose(p: Prof) {
    if (busy) return
    busy = true
    error = ''
    const res = await window.cr.auth.switchProfile(p.profile_id)
    if (!res.ok) {
      error = res.error
      busy = false
      return
    }
    clearHome() // the home feed is profile-specific
    prefetchHome() // warm the chosen profile's home while we navigate
    goto('/home')
  }

  onMount(async () => {
    if (!window.cr) {
      phase = 'error'
      error = 'Preload bridge unavailable.'
      return
    }
    const res = await window.cr.auth.profiles()
    if (!res.ok) {
      phase = 'error'
      error = res.error
      return
    }
    profiles = res.data ?? []
    // start on the account's currently-selected profile so its wallpaper shows first
    const sel = profiles.findIndex((p) => p.is_selected)
    activeIdx = sel >= 0 ? sel : 0
    phase = 'ready'
    requestAnimationFrame(() =>
      document.getElementById(`profile-${activeIdx}`)?.focus({ preventScroll: true })
    )
  })
</script>

<div class="relative grid h-screen w-full place-items-center overflow-hidden bg-surface">
  <!-- Per-profile wallpaper: all stacked + preloaded, the focused one crossfades in.
       Mirrors CR's profile picker, where the background follows the highlighted user.
       fixed (not absolute) so it's pinned to the viewport — focus nav's scrollIntoView can
       scroll the (overflow-hidden but still programmatically-scrollable) content sideways, and an
       absolute layer would scroll with it, exposing a bare strip. -->
  {#if phase === 'ready'}
    <div class="pointer-events-none fixed inset-0">
      {#each profiles as p, i}
        {#if WALLPAPER(p.wallpaper)}
          <img
            src={WALLPAPER(p.wallpaper)}
            alt=""
            class="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out"
            style="opacity:{i === activeIdx ? 1 : 0}"
          />
        {/if}
      {/each}
      <!-- scrim so the avatars + title stay legible over any wallpaper -->
      <div class="absolute inset-0 bg-surface/55"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-surface/30"></div>
    </div>
  {/if}

  {#if phase === 'loading'}
    <div class="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-brand"></div>
  {:else if phase === 'error'}
    <div class="text-center">
      <p class="mb-2 font-bold text-brand">Couldn't load profiles</p>
      <p class="max-w-md text-sm text-white/50">{error}</p>
    </div>
  {:else}
    <div class="relative z-10 text-center">
      <h1 class="mb-12 text-4xl font-black text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">Who's watching?</h1>
      <div class="flex max-w-5xl flex-wrap items-start justify-center gap-8">
        {#each profiles as p, i}
          <button
            id={`profile-${i}`}
            data-focusable
            data-focus-self
            disabled={busy}
            onclick={() => choose(p)}
            onfocus={() => (activeIdx = i)}
            onmouseenter={() => (activeIdx = i)}
            class="group flex w-40 flex-col items-center gap-3 outline-none disabled:opacity-60"
          >
            <!-- CR avatars are themed square art — let them fill the tile (no blur/shrink). -->
            <div
              class="relative h-40 w-40 overflow-hidden rounded-2xl bg-surface-2 opacity-80 ring-2 ring-white/10 transition duration-150 group-select:opacity-100 group-select:scale-105 group-select:ring-4 group-select:ring-brand"
            >
              <img src={AVATAR(p.avatar)} alt={label(p)} class="h-full w-full object-cover" />
            </div>
            <span class="text-lg font-bold text-white/60 transition group-select:text-white">{label(p)}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if busy}
    <div class="absolute inset-0 z-20 grid place-items-center bg-surface/70">
      <div class="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-brand"></div>
    </div>
  {/if}
</div>
