<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'

  let username = $state('')
  let password = $state('')
  let error = $state('')
  let busy = $state(false)

  onMount(() => document.getElementById('login-user')?.focus())

  async function submit(e: Event) {
    e.preventDefault()
    busy = true
    error = ''
    const res = await window.cr.auth.login(username, password)
    busy = false
    if (res.ok && res.data.authenticated) goto('/home')
    else error = res.ok ? 'Login failed' : res.error
  }
</script>

<div class="grid h-screen place-items-center">
  <form class="w-[420px] rounded-card bg-surface-1 p-8" onsubmit={submit}>
    <h1 class="mb-6 text-2xl font-black text-brand">Sign in to Crunchyroll</h1>
    <input
      id="login-user"
      data-focusable
      bind:value={username}
      placeholder="Email"
      class="mb-3 w-full rounded bg-surface-2 p-3 outline-none select:ring-2 select:ring-brand"
    />
    <input
      id="login-pass"
      data-focusable
      type="password"
      bind:value={password}
      placeholder="Password"
      class="mb-4 w-full rounded bg-surface-2 p-3 outline-none select:ring-2 select:ring-brand"
    />
    {#if error}<p class="mb-3 text-sm text-red-400">{error}</p>{/if}
    <button
      id="login-submit"
      data-focusable
      type="submit"
      disabled={busy}
      class="w-full rounded bg-brand p-3 font-bold text-black outline-none select:ring-4 select:ring-white/40 disabled:opacity-50"
    >
      {busy ? 'Signing in…' : 'Sign In'}
    </button>
    <p class="mt-4 text-center text-xs text-white/40">QR / device login coming soon.</p>
  </form>
</div>
