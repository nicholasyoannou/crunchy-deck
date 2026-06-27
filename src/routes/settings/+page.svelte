<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { clearHome } from '$lib/api/homeStore'

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
