<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import QRCode from 'qrcode'

  let mode: 'qr' | 'email' = $state('qr')

  const BG =
    'https://static.crunchyroll.com/cr-acquisition/assets/img/start/hero/us-global/background-desktop.jpg'
  let bgLoaded = $state(false)

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
    if (!window.cr) {
      qrStatus = 'error'
      qrError = 'Preload bridge unavailable (window.cr missing).'
      return
    }
    const res = await window.cr.device.code()
    if (!res.ok) {
      qrStatus = 'error'
      qrError = res.error
      return
    }
    const { user_code, verification_uri, device_code, expires_in, interval } = res.data
    userCode = user_code
    verifyUri = verification_uri
    // CR's /device/code returns no verification_uri, so we embed the code ourselves: scanning then
    // opens a pre-filled activation page (sign in automatically, like the Crunchyroll TV app).
    const qrTarget = /[?&]/.test(verification_uri) ? verification_uri : `${verification_uri}?code=${user_code}`
    qrImg = await QRCode.toDataURL(qrTarget, { width: 176, margin: 1 })
    qrStatus = 'waiting'
    // CR quirk: expires_in is seconds, but interval is milliseconds.
    expireTimer = setTimeout(() => {
      stopPolling()
      qrStatus = 'expired'
    }, Math.max(5, expires_in) * 1000)

    const doPoll = async () => {
      const p = await window.cr.device.poll(device_code)
      if (!p.ok) return
      const s = p.data.status
      if (s === 'ok') {
        stopPolling()
        goto('/profiles')
      } else if (s === 'expired') {
        stopPolling()
        qrStatus = 'expired'
      } else if (s === 'error') {
        stopPolling()
        qrStatus = 'error'
        qrError = p.data.error ?? 'Device login failed'
      }
      // pending / slow_down -> keep waiting
    }
    const pollMs = Math.min(5000, Math.max(1000, interval)) // interval is ms; clamp to 1–5s
    doPoll() // poll immediately, then on interval
    poll = setInterval(doPoll, pollMs)
  }

  async function submitEmail(e: Event) {
    e.preventDefault()
    busy = true
    emailError = ''
    const res = await window.cr.auth.login(username, password)
    busy = false
    if (res.ok && res.data.authenticated) goto('/profiles')
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

<div class="relative h-screen w-screen overflow-hidden">
  <img
    src={BG}
    alt=""
    onload={() => (bgLoaded = true)}
    class="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out"
    style="opacity:{bgLoaded ? 0.3 : 0}"
  />
  <div class="absolute inset-0 bg-surface/50"></div>
  <div class="relative grid h-full place-items-center">
  {#if mode === 'qr'}
    <div class="w-[360px] rounded-card bg-surface-1 p-6 text-center">
      <h1 class="mb-1 text-xl font-black text-brand">Sign in to Crunchyroll</h1>
      <p class="mb-4 text-xs text-white/60">Scan the QR code with your phone</p>

      <div class="mx-auto mb-3 grid h-[192px] w-[192px] place-items-center rounded-lg bg-white">
        {#if qrImg}
          <img src={qrImg} alt="Sign-in QR code" class="h-[176px] w-[176px]" />
        {:else}
          <span class="text-black/40">…</span>
        {/if}
      </div>

      {#if qrStatus === 'waiting'}
        <p class="mb-2 text-xs text-white/70">
          Or visit <span class="font-semibold text-white">{verifyUri.replace(/^https?:\/\/(www\.)?/, '')}</span> and enter
        </p>
        <div class="mb-3 flex justify-center gap-1.5">
          {#each userCode.toUpperCase().split('') as ch}
            <span
              class="grid h-9 w-7 place-items-center rounded-md border border-white/15 bg-surface-2 text-lg font-bold text-white"
            >{ch}</span>
          {/each}
        </div>
        <p class="text-[11px] text-white/40">Stay on this screen — you'll be signed in automatically.</p>
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

      <div class="mt-4 border-t border-white/10 pt-3">
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
</div>
