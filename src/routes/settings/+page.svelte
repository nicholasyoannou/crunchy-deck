<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { clearHome } from '$lib/api/homeStore'
  import { getSkipSeconds, setSkipSeconds, SKIP_OPTIONS } from '$lib/playback/skip'

  // --- playback: L1/R1 skip interval ---
  let skip = $state(3)
  function chooseSkip(n: number) {
    skip = n
    setSkipSeconds(n)
  }

  let account = $state<{ account_id?: string; country?: string } | null>(null)
  let phase = $state<'loading' | 'ready' | 'error'>('loading')
  let error = $state('')
  let busy = $state(false)

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
    upd = await window.cr.update.getState()
    window.cr.update.onState((st) => (upd = st))
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('#app-content [data-focusable]')?.focus()
    )
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
        <div class="rounded-card bg-surface-1 p-4 text-sm text-white/70">
          <div>Region: <span class="text-white">{account?.country ?? '—'}</span></div>
          <div class="mt-1 break-all">ID: <span class="text-white/50">{account?.account_id ?? '—'}</span></div>
        </div>
      </section>

      <section>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-white/40">Playback</h2>
        <div class="rounded-card bg-surface-1 p-4 text-sm">
          <div class="mb-2.5 text-white/70">Skip interval <span class="text-white/40">(L1 / R1)</span></div>
          <div class="flex flex-wrap gap-2">
            {#each SKIP_OPTIONS as n, i}
              <button
                id={`skip-${i}`}
                data-focusable
                onclick={() => chooseSkip(n)}
                class="rounded px-3 py-2 font-bold outline-none transition select:ring-2 select:ring-brand {skip === n
                  ? 'bg-brand text-black'
                  : 'bg-surface-2 text-white/80'}">{n}s</button
              >
            {/each}
          </div>
        </div>
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
