# Login QR / Manual / Email modes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the login screen into a primary QR view (auto sign-in) and a toggleable Manual code view (CR-TV style), sharing one device-flow session, with email/password kept as a third option.

**Architecture:** The renderer (`+page.svelte`) starts one device-flow session on mount and polls continuously; `qr` and `manual` are two views over that single session, so toggling never re-requests a code. The QR encodes CR's `verification_uri_complete` (code-embedded → auto sign-in); the Manual view shows the bare `verification_uri` + the human code. A pure mapper in the electron main process exposes both URLs and is unit-tested in isolation.

**Tech Stack:** Electron main (TS, NodeNext ESM, `.js` import specifiers), SvelteKit + Svelte 5 runes, Tailwind, `qrcode`, Vitest (jsdom).

---

## File structure

- **Create** `electron/cr/deviceCode.ts` — pure `DeviceCode` interface + `mapDeviceCodeResponse(raw)`. No electron/network imports → unit-testable.
- **Create** `electron/cr/deviceCode.test.ts` — vitest unit tests for the mapper.
- **Modify** `vite.config.ts` — widen the test `include` glob to also match `electron/**/*.test.ts`.
- **Modify** `electron/cr/device.ts` — drop the inline interface/mapping, delegate to `mapDeviceCodeResponse`, re-export the type.
- **Modify** `src/app.d.ts` — add `verification_uri_complete: string` to the `device.code()` result type.
- **Modify** `src/routes/login/+page.svelte` — full rewrite: three view modes, shared session, layouts, controller focus.

No changes to `electron/preload.ts` or `electron/ipc.ts` — `device:code` already passes `requestDeviceCode()` straight through `wrap`, so the extra field flows automatically.

---

## Task 1: Pure device-code mapper + tests

**Files:**
- Create: `electron/cr/deviceCode.ts`
- Test: `electron/cr/deviceCode.test.ts`
- Modify: `vite.config.ts:8`

- [ ] **Step 1: Widen the test glob so electron tests are picked up**

In `vite.config.ts`, change the `include` line:

```ts
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts']
  }
})
```

- [ ] **Step 2: Write the failing test**

Create `electron/cr/deviceCode.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapDeviceCodeResponse } from './deviceCode'

describe('mapDeviceCodeResponse', () => {
  it('maps a full response and keeps the complete URI distinct from the bare one', () => {
    const m = mapDeviceCodeResponse({
      device_code: 'dev-123',
      user_code: '7nh4kq',
      verification_uri: 'https://www.crunchyroll.com/activate',
      verification_uri_complete: 'https://www.crunchyroll.com/activate?code=7NH4KQ',
      expires_in: 600,
      polling_interval: 5
    })
    expect(m).toEqual({
      device_code: 'dev-123',
      user_code: '7nh4kq',
      verification_uri: 'https://www.crunchyroll.com/activate',
      verification_uri_complete: 'https://www.crunchyroll.com/activate?code=7NH4KQ',
      expires_in: 600,
      interval: 5
    })
  })

  it('falls back complete -> bare when verification_uri_complete is absent', () => {
    const m = mapDeviceCodeResponse({
      device_code: 'd',
      user_code: 'abcdef',
      verification_uri: 'https://www.crunchyroll.com/activate'
    })
    expect(m.verification_uri_complete).toBe('https://www.crunchyroll.com/activate')
    expect(m.verification_uri).toBe('https://www.crunchyroll.com/activate')
  })

  it('falls back both URIs to the default activate URL when none provided', () => {
    const m = mapDeviceCodeResponse({ device_code: 'd', user_code: 'x' })
    expect(m.verification_uri).toBe('https://www.crunchyroll.com/activate')
    expect(m.verification_uri_complete).toBe('https://www.crunchyroll.com/activate')
  })

  it('prefers polling_interval over interval and defaults expires_in to 300', () => {
    expect(mapDeviceCodeResponse({ polling_interval: 7, interval: 99 }).interval).toBe(7)
    expect(mapDeviceCodeResponse({ interval: 9 }).interval).toBe(9)
    expect(mapDeviceCodeResponse({}).interval).toBe(5)
    expect(mapDeviceCodeResponse({}).expires_in).toBe(300)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm exec vitest run electron/cr/deviceCode.test.ts`
Expected: FAIL — `Failed to resolve import "./deviceCode"` (file does not exist yet).

- [ ] **Step 4: Write the mapper**

Create `electron/cr/deviceCode.ts`:

```ts
// Pure mapping of CR's POST /auth/v1/device/code response into our DeviceCode shape.
// No electron / network imports here so it can be unit-tested in isolation.
//
//   verification_uri          -> bare activate URL, shown on the Manual screen
//   verification_uri_complete -> RFC 8628 code-embedded URL, encoded in the QR so a
//                                phone scan signs in automatically. Falls back to the
//                                bare URL when CR omits it (then the QR has no auto-fill).
export interface DeviceCode {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

const DEFAULT_ACTIVATE = 'https://www.crunchyroll.com/activate'

export function mapDeviceCodeResponse(r: any): DeviceCode {
  const bare = r?.verification_uri || DEFAULT_ACTIVATE
  return {
    device_code: r?.device_code,
    user_code: r?.user_code,
    verification_uri: bare,
    verification_uri_complete: r?.verification_uri_complete || bare,
    expires_in: r?.expires_in ?? 300,
    interval: r?.polling_interval ?? r?.interval ?? 5
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run electron/cr/deviceCode.test.ts`
Expected: PASS — 4 passing.

- [ ] **Step 6: Commit**

```bash
git add electron/cr/deviceCode.ts electron/cr/deviceCode.test.ts vite.config.ts
git commit -m "feat(auth): pure device-code mapper exposing bare + complete verification URIs"
```

---

## Task 2: Delegate device.ts to the mapper

**Files:**
- Modify: `electron/cr/device.ts:30-51`

- [ ] **Step 1: Replace the inline interface + mapping with the mapper**

In `electron/cr/device.ts`, delete the local `DeviceCode` interface (lines ~30-36) and the inline object mapping inside `requestDeviceCode` (lines ~44-50). Add an import at the top (next to the other `./*.js` imports) and re-export the type:

```ts
import { mapDeviceCodeResponse, type DeviceCode } from './deviceCode.js'

export type { DeviceCode }
```

Then make `requestDeviceCode` delegate:

```ts
export async function requestDeviceCode(): Promise<DeviceCode> {
  const r: any = await crFetch(`${CR.API}/auth/v1/device/code`, {
    clientAuth: true,
    form: { device_id: deviceId(), device_type: DEVICE_TYPE, device_name: DEVICE_NAME }
  })
  console.log('[device] /code response:', JSON.stringify(r))
  return mapDeviceCodeResponse(r)
}
```

Leave `PollStatus`, `pollDeviceToken`, `deviceId`, and the constants unchanged.

- [ ] **Step 2: Verify the full test suite still passes**

Run: `pnpm test`
Expected: PASS — existing suites plus the new `deviceCode` suite; no failures.

- [ ] **Step 3: Verify the electron main typechecks**

Run: `pnpm exec tsc -p tsconfig.node.json --noEmit`
Expected: no errors. (Confirms the `./deviceCode.js` NodeNext import resolves and `DeviceCode` re-export is valid.)

- [ ] **Step 4: Commit**

```bash
git add electron/cr/device.ts
git commit -m "refactor(auth): requestDeviceCode delegates to mapDeviceCodeResponse"
```

---

## Task 3: Expose verification_uri_complete on the renderer bridge type

**Files:**
- Modify: `src/app.d.ts:33`

- [ ] **Step 1: Add the field to the device.code() result type**

In `src/app.d.ts`, update the `device.code()` signature (line 33) to include `verification_uri_complete`:

```ts
  device: {
    code(): Promise<
      CrResult<{
        device_code: string
        user_code: string
        verification_uri: string
        verification_uri_complete: string
        expires_in: number
        interval: number
      }>
    >
    poll(
      device_code: string
    ): Promise<CrResult<{ status: 'ok' | 'pending' | 'slow_down' | 'expired' | 'error'; error?: string }>>
  }
```

- [ ] **Step 2: Verify svelte-check passes**

Run: `pnpm check`
Expected: no errors (the type is additive; nothing references it yet).

- [ ] **Step 3: Commit**

```bash
git add src/app.d.ts
git commit -m "types: add verification_uri_complete to device.code() bridge result"
```

---

## Task 4: Rewrite the login screen — QR / Manual / Email modes

**Files:**
- Modify: `src/routes/login/+page.svelte` (full rewrite)

- [ ] **Step 1: Replace the file with the three-mode implementation**

Overwrite `src/routes/login/+page.svelte` with:

```svelte
<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import { goto } from '$app/navigation'
  import QRCode from 'qrcode'

  let mode: 'qr' | 'manual' | 'email' = $state('qr')

  const BG =
    'https://static.crunchyroll.com/cr-acquisition/assets/img/start/hero/us-global/background-desktop.jpg'
  let bgLoaded = $state(false)

  // Shared device flow — `qr` and `manual` are two views of ONE session.
  let qrImg = $state('')
  let userCode = $state('')
  let verifyUri = $state('https://www.crunchyroll.com/activate') // bare, shown on manual
  let flowStatus: 'starting' | 'waiting' | 'expired' | 'error' = $state('starting')
  let flowError = $state('')
  let poll: ReturnType<typeof setInterval> | null = null
  let expireTimer: ReturnType<typeof setTimeout> | null = null

  // Email fallback (independent of the device session)
  let username = $state('')
  let password = $state('')
  let busy = $state(false)
  let emailError = $state('')

  function stopFlow() {
    if (poll) { clearInterval(poll); poll = null }
    if (expireTimer) { clearTimeout(expireTimer); expireTimer = null }
  }

  async function startDeviceFlow() {
    stopFlow()
    flowStatus = 'starting'
    flowError = ''
    qrImg = ''
    if (!window.cr) {
      flowStatus = 'error'
      flowError = 'Preload bridge unavailable (window.cr missing).'
      return
    }
    const res = await window.cr.device.code()
    if (!res.ok) {
      flowStatus = 'error'
      flowError = res.error
      return
    }
    const { user_code, verification_uri, verification_uri_complete, device_code, expires_in, interval } = res.data
    userCode = user_code
    verifyUri = verification_uri
    // QR encodes the code-embedded URL so a phone scan signs in automatically.
    qrImg = await QRCode.toDataURL(verification_uri_complete, { width: 240, margin: 1 })
    flowStatus = 'waiting'
    // CR quirk: expires_in is seconds.
    expireTimer = setTimeout(() => {
      stopFlow()
      flowStatus = 'expired'
    }, Math.max(5, expires_in) * 1000)

    const doPoll = async () => {
      const p = await window.cr.device.poll(device_code)
      if (!p.ok) return
      const s = p.data.status
      if (s === 'ok') {
        stopFlow()
        goto('/home')
      } else if (s === 'expired') {
        stopFlow()
        flowStatus = 'expired'
      } else if (s === 'error') {
        stopFlow()
        flowStatus = 'error'
        flowError = p.data.error ?? 'Device login failed'
      }
      // pending / slow_down -> keep waiting
    }
    const pollMs = Math.min(5000, Math.max(1000, interval)) // interval is ms; clamp 1–5s
    doPoll() // poll immediately, then on interval
    poll = setInterval(doPoll, pollMs)
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

  function focusFirst() {
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-focusable]')?.focus())
  }

  // Toggle views WITHOUT restarting the shared device flow.
  async function setMode(m: 'qr' | 'manual' | 'email') {
    mode = m
    await tick()
    focusFirst()
  }

  onMount(() => {
    startDeviceFlow()
    focusFirst()
  })
  onDestroy(stopFlow)
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
      <div class="w-[460px] rounded-card bg-surface-1 p-8 text-center">
        <h1 class="mb-1 text-2xl font-black text-brand">Sign in to Crunchyroll</h1>
        <p class="mb-6 text-sm text-white/60">Scan the QR code with your phone to sign in automatically</p>

        <div class="mx-auto mb-4 grid h-[256px] w-[256px] place-items-center rounded-lg bg-white">
          {#if qrImg}
            <img src={qrImg} alt="Sign-in QR code" class="h-[240px] w-[240px]" />
          {:else}
            <span class="text-black/40">…</span>
          {/if}
        </div>

        {#if flowStatus === 'waiting'}
          <p class="mb-3 text-xs text-white/40">
            Can't scan? Code:
            <span class="font-semibold tracking-widest text-white/70">{userCode.toUpperCase()}</span>
          </p>
          <p class="text-xs text-white/40">Stay on this screen — you'll be signed in automatically.</p>
        {:else if flowStatus === 'starting'}
          <p class="mb-4 text-white/60">Generating code…</p>
        {:else if flowStatus === 'expired'}
          <p class="mb-4 text-yellow-400">Code expired.</p>
          <button
            data-focusable
            onclick={startDeviceFlow}
            class="rounded bg-brand px-5 py-2 font-bold text-black outline-none select:ring-4 select:ring-white/40"
          >Generate new code</button>
        {:else}
          <p class="mb-2 text-red-400">Couldn't start QR sign-in.</p>
          <p class="mb-3 break-words text-xs text-white/40">{flowError}</p>
          <button
            data-focusable
            onclick={startDeviceFlow}
            class="rounded bg-brand px-5 py-2 font-bold text-black outline-none select:ring-4 select:ring-white/40"
          >Try again</button>
        {/if}

        <div class="mt-6 flex flex-col gap-2 border-t border-white/10 pt-4">
          <button
            data-focusable
            onclick={() => setMode('manual')}
            class="text-sm text-white/60 underline outline-none select:text-brand"
          >Enter code manually instead</button>
          <button
            data-focusable
            onclick={() => setMode('email')}
            class="text-sm text-white/40 underline outline-none select:text-brand"
          >Sign in with email &amp; password</button>
        </div>
      </div>
    {:else if mode === 'manual'}
      <div class="w-[460px] rounded-card bg-surface-1 p-8">
        <h1 class="mb-6 text-2xl font-black text-brand">Sign in to Crunchyroll</h1>

        {#if flowStatus === 'waiting' || flowStatus === 'starting'}
          <ol class="space-y-5">
            <li class="flex items-start gap-4">
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/30 text-sm text-white/70">1</span>
              <div>
                <p class="text-sm text-white/50">Go to:</p>
                <p class="text-lg font-semibold text-white">{verifyUri.replace(/^https?:\/\/(www\.)?/, '')}</p>
              </div>
            </li>
            <li class="flex items-start gap-4">
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/30 text-sm text-white/70">2</span>
              <div>
                <p class="mb-2 text-sm text-white/50">Enter this code:</p>
                {#if flowStatus === 'waiting'}
                  <div class="flex gap-2">
                    {#each userCode.toUpperCase().split('') as ch}
                      <span
                        class="grid h-12 w-10 place-items-center rounded-md border border-white/15 bg-surface-2 text-2xl font-bold text-white"
                      >{ch}</span>
                    {/each}
                  </div>
                {:else}
                  <p class="text-white/40">Generating…</p>
                {/if}
              </div>
            </li>
            <li class="flex items-start gap-4">
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/30 text-sm text-white/70">3</span>
              <p class="text-white/70">Stay on this screen and you'll be signed in automatically.</p>
            </li>
          </ol>
        {:else if flowStatus === 'expired'}
          <p class="mb-4 text-yellow-400">Code expired.</p>
          <button
            data-focusable
            onclick={startDeviceFlow}
            class="rounded bg-brand px-5 py-2 font-bold text-black outline-none select:ring-4 select:ring-white/40"
          >Generate new code</button>
        {:else}
          <p class="mb-2 text-red-400">Couldn't start sign-in.</p>
          <p class="mb-3 break-words text-xs text-white/40">{flowError}</p>
          <button
            data-focusable
            onclick={startDeviceFlow}
            class="rounded bg-brand px-5 py-2 font-bold text-black outline-none select:ring-4 select:ring-white/40"
          >Try again</button>
        {/if}

        <div class="mt-8 flex flex-col gap-2 border-t border-white/10 pt-4">
          <button
            data-focusable
            onclick={() => setMode('qr')}
            class="text-sm text-white/60 underline outline-none select:text-brand"
          >← Show QR code</button>
          <button
            data-focusable
            onclick={() => setMode('email')}
            class="text-sm text-white/40 underline outline-none select:text-brand"
          >Sign in with email &amp; password</button>
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
          onclick={() => setMode('qr')}
          class="mt-4 w-full text-center text-sm text-white/60 underline outline-none select:text-brand"
        >← Use QR code instead</button>
      </form>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Verify types + svelte compile**

Run: `pnpm check`
Expected: no errors (`res.data.verification_uri_complete` resolves against the Task 3 type).

- [ ] **Step 3: Verify the test suite still passes**

Run: `pnpm test`
Expected: PASS — no regressions.

- [ ] **Step 4: Manual verification (run the app)**

Run: `pnpm dev`

Check:
- QR screen is the default; QR renders; small "Can't scan? Code: XXXXXX" line shows under it.
- Scanning the QR on a phone signs in automatically and the app routes to `/home`.
- "Enter code manually instead" switches to the numbered-steps screen showing the **same** code; no new code is requested (watch the `[device] /code response` log — it should not re-fire on toggle).
- "← Show QR code" returns to the QR view, still the same session.
- "Sign in with email & password" reaches the form; a valid login routes to `/home`; "← Use QR code instead" returns.
- Let a code expire (or shorten `expires_in` for a manual test) → "Generate new code" appears and regenerates from either view.
- With a controller / keyboard Tab, every screen has a reachable focused element after each switch.

- [ ] **Step 5: Commit**

```bash
git add src/routes/login/+page.svelte
git commit -m "feat(login): split QR (auto sign-in) and manual code into toggleable views sharing one device-flow session"
```

---

## Self-review notes

- **Spec coverage:** modes/IA (Task 4), shared session no-restart (Task 4 `setMode`), return-both-URIs (Tasks 1–3), QR + fallback code (Task 4 qr branch), CR-TV manual layout (Task 4 manual branch), email 3rd option (Task 4 email branch), shared states/expiry (Task 4), controller focus (Task 4 `focusFirst`/`data-focusable`), unit test of mapper (Task 1), manual checklist (Task 4 Step 4). All covered.
- **Build-time check from the spec:** Task 4 Step 4 watches the `[device] /code response` log to confirm `verification_uri_complete` is present; if absent, the QR silently falls back to the bare URL (still valid, no auto-fill) and that becomes the bug to chase next.
- **Out of scope:** DRM/identity (40131) follow-up — see the spec's Risks section, not addressed here.
