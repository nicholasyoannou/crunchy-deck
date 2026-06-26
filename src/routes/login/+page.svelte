<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import QRCode from 'qrcode'

  let mode: 'qr' | 'email' = $state('qr')

  // QR / device flow
  let qrImg = $state('')
  let userCode = $state('')
  let verifyUri = $state('https://www.crunchyroll.com/activate')
  let qrStatus: 'starting' | 'waiting' | 'expired' | 'error' = $state('starting')
  let qrError = $state('')
  let poll: ReturnType<typeof setInterval> | null = null
  let expireTimer: ReturnType<typeof setTimeout> | null = null

  // email fallback
  let username = $state('')
  let password = $state('')
  let busy = $state(false)
  let emailError = $state('')

  function stopPolling() {
    if (poll) { clearInterval(poll); poll = null }
    if (expireTimer) { clearTimeout(expireTimer); expireTimer = null }
  }

  async function startQr() {
    stopPolling()
    qrStatus = 'starting'
    qrError = ''
    qrImg = ''
    const res = await window.cr.device.code()
    if (!res.ok) {
      qrStatus = 'error'
      qrError = res.error
      return
    }
    const { user_code, verification_uri, device_code, expires_in, interval } = res.data
    userCode = user_code
    verifyUri = verification_uri
    qrImg = await QRCode.toDataURL(verification_uri, { width: 240, margin: 1 })
    qrStatus = 'waiting'
    expireTimer = setTimeout(() => {
      stopPolling()
      qrStatus = 'expired'
    }, Math.max(5, expires_in) * 1000)
    poll = setInterval(async () => {
      const p = await window.cr.device.poll(device_code)
      if (!p.ok) return
      const s = p.data.status
      if (s === 'ok') {
        stopPolling()
        goto('/home')
      } else if (s === 'expired') {
        stopPolling()
        qrStatus = 'expired'
      } else if (s === 'error') {
        stopPolling()
        qrStatus = 'error'
        qrError = p.data.error ?? 'Device login failed'
      }
      // pending / slow_down -> keep waiting
    }, Math.max(2, interval) * 1000)
  }

  async function submitEmail(e: Event) {
    e.preventDefault()
    busy = true
    emailError = ''
    const res = await window.cr.auth.login(username, password)
    busy = false
    if (res.ok && res.data.authenticated) goto('/home')
    else emailError = res.ok ? 'Login failed' : res.error
  }

  function toEmail() {
    mode = 'email'
    stopPolling()
  }
  function toQr() {
    mode = 'qr'
    startQr()
  }

  onMount(() => {
    startQr()
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-focusable]')?.focus())
  })
  onDestroy(stopPolling)
</script>

<div class="grid h-screen place-items-center">
  {#if mode === 'qr'}
    <div class="w-[460px] rounded-card bg-surface-1 p-8 text-center">
      <h1 class="mb-1 text-2xl font-black text-brand">Sign in to Crunchyroll</h1>
      <p class="mb-6 text-sm text-white/60">Scan the QR code with your phone</p>

      <div class="mx-auto mb-4 grid h-[256px] w-[256px] place-items-center rounded-lg bg-white">
        {#if qrImg}
          <img src={qrImg} alt="Sign-in QR code" class="h-[240px] w-[240px]" />
        {:else}
          <span class="text-black/40">…</span>
        {/if}
      </div>

      {#if qrStatus === 'waiting'}
        <p class="text-sm text-white/70">
          Or go to <span class="font-bold text-white">{verifyUri.replace('https://www.', '')}</span>
        </p>
        <p class="mb-4 mt-1">
          Code: <span class="font-mono text-2xl font-bold tracking-widest text-brand">{userCode}</span>
        </p>
        <p class="text-xs text-white/40">Stay on this screen — you'll be signed in automatically.</p>
      {:else if qrStatus === 'starting'}
        <p class="mb-4 text-white/60">Generating code…</p>
      {:else if qrStatus === 'expired'}
        <p class="mb-4 text-yellow-400">Code expired.</p>
        <button
          data-focusable
          onclick={startQr}
          class="rounded bg-brand px-5 py-2 font-bold text-black outline-none select:ring-4 select:ring-white/40"
        >Generate new code</button>
      {:else}
        <p class="mb-2 text-red-400">Couldn't start QR sign-in.</p>
        <p class="mb-3 break-words text-xs text-white/40">{qrError}</p>
        <button
          data-focusable
          onclick={startQr}
          class="rounded bg-brand px-5 py-2 font-bold text-black outline-none select:ring-4 select:ring-white/40"
        >Try again</button>
      {/if}

      <div class="mt-6 border-t border-white/10 pt-4">
        <button
          data-focusable
          onclick={toEmail}
          class="text-sm text-white/60 underline outline-none select:text-brand"
        >Alternatively, sign in with email &amp; password</button>
      </div>
    </div>
  {:else}
    <form class="w-[420px] rounded-card bg-surface-1 p-8" onsubmit={submitEmail}>
      <h1 class="mb-6 text-2xl font-black text-brand">Sign in with email</h1>
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
      {#if emailError}<p class="mb-3 text-sm text-red-400">{emailError}</p>{/if}
      <button
        id="login-submit"
        data-focusable
        type="submit"
        disabled={busy}
        class="w-full rounded bg-brand p-3 font-bold text-black outline-none select:ring-4 select:ring-white/40 disabled:opacity-50"
      >{busy ? 'Signing in…' : 'Sign In'}</button>
      <button
        type="button"
        data-focusable
        onclick={toQr}
        class="mt-4 w-full text-center text-sm text-white/60 underline outline-none select:text-brand"
      >← Use QR code instead</button>
    </form>
  {/if}
</div>
