# Foundation: Widevine Spike + Controller-Navigable Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the project and de-risk the two things that define it — (A) DRM video actually plays through a VMP-signed Widevine CDM, and (B) controller navigation *feels native* — producing one runnable app with a gamepad-navigable demo screen and a working Widevine test-stream player.

**Architecture:** castLabs Electron (Widevine fork) hosts a SvelteKit SPA renderer. The renderer holds a Shaka Player surface (EME → CDM) plus a forked-from-Hayase spatial-navigation + gamepad input engine. Main process boots the CDM, owns the window, and will later own the keyring + API proxy. This plan covers milestones **M0** (Widevine spike) and the **core of M1** (input engine + design tokens + one demo screen). Real Crunchyroll data, auth, and full screens come in later plans.

**Tech Stack:** pnpm · castLabs Electron (`+wvcus`) · SvelteKit 2 + Svelte 5 (adapter-static SPA) · Vite · TypeScript (strict) · Tailwind CSS · Shaka Player · Vitest (jsdom) · electron-builder · castLabs EVS (Python, VMP signing).

**Environment note:** Development is on **Windows** (Node 22, pnpm 10, Python 3.13). The app runs on Windows for dev/feel-testing; Widevine works in the castLabs fork on Windows too, so M0 is provable here. Steam-Deck-specific packaging (Flatpak/Gamescope/VAAPI/controller template) is a **later plan** validated on-device.

**Conventions:**
- Co-locate unit tests next to source as `*.test.ts` (Vitest).
- Pure logic is separated from DOM/Electron so it is unit-testable without a browser.
- Commit after every passing step. Work on a `foundation` branch (created in Task 1), never commit straight to `main`.
- Run commands from the repo root: `C:\Users\Student\Documents\Coding projects\Testing\linux-crunchyroll`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | scripts, deps (incl. castLabs electron), electron-builder config |
| `tsconfig.json` / `tsconfig.node.json` | TS config for renderer / electron |
| `svelte.config.js`, `vite.config.ts` | SvelteKit SPA + Vitest config |
| `tailwind.config.ts`, `postcss.config.js`, `src/app.css` | design tokens, `select` variant, fonts, focus styling |
| `electron/main.ts` | window lifecycle, Widevine `components.whenReady()`, GPU flags |
| `electron/preload.ts` | typed `contextBridge` (`window.cr`) |
| `src/app.html`, `src/routes/+layout.ts`, `src/routes/+layout.svelte` | SPA root, ssr off, mounts input engine |
| `src/lib/input/spatial.ts` (+`.test.ts`) | **pure** nearest-in-direction math |
| `src/lib/input/navigate.ts` | DOM wrapper: query focusables, overrides, center-scroll, never-null |
| `src/lib/input/gamepad.ts` (+`.test.ts`) | pure button/axis → `NavCommand`, hysteresis |
| `src/lib/input/repeat.ts` (+`.test.ts`) | accelerating key-repeat (injected clock) |
| `src/lib/input/poller.ts` | rAF gamepad poll → dispatch directional keys |
| `src/lib/input/inputType.ts` | `'dpad'\|'mouse'\|'touch'` store → `data-input` |
| `src/lib/player/Shaka.svelte` | Shaka surface; plays a manifest+license |
| `src/lib/ui/Card.svelte`, `src/routes/demo/+page.svelte` | demo focusable grid (feel-check) |
| `src/routes/widevine-test/+page.svelte` | M0 Widevine test-stream page |
| `scripts/sign-vmp.md` | castLabs EVS signing runbook |

---

## Part A — Scaffold & Widevine Spike (M0)

### Task 1: Project init + base config

**Files:**
- Create: `package.json`, `.gitignore`, `tsconfig.json`, `tsconfig.node.json`

- [ ] **Step 1: Initialize repo + branch**

Run:
```bash
git init
git checkout -b foundation
pnpm init
```

- [ ] **Step 2: Write `.gitignore`**

```gitignore
node_modules/
build/
dist-electron/
release/
.svelte-kit/
.DS_Store
*.log
.env
_research/
```
(`_research/` holds the cloned reference repos + extracted APK — keep them local, out of git.)

- [ ] **Step 3: Write `package.json`**

```json
{
  "name": "crunchy-deck",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev:web": "vite dev --port 5173",
    "build:web": "vite build",
    "build:electron": "tsc -p tsconfig.node.json",
    "dev": "concurrently -k \"pnpm dev:web\" \"wait-on tcp:5173 && cross-env ELECTRON_RENDERER_URL=http://localhost:5173 electron .\"",
    "build": "pnpm build:web && pnpm build:electron",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "svelte-check --tsconfig ./tsconfig.json"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^3.0.6",
    "@sveltejs/kit": "^2.8.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "concurrently": "^9.1.0",
    "cross-env": "^7.0.3",
    "electron": "https://github.com/castlabs/electron-releases#v40.7.0+wvcus",
    "electron-builder": "^25.1.8",
    "jsdom": "^25.0.1",
    "svelte": "^5.1.0",
    "svelte-check": "^4.0.0",
    "tailwindcss": "^3.4.14",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "wait-on": "^8.0.1"
  },
  "dependencies": {
    "shaka-player": "^4.11.0"
  },
  "build": {
    "appId": "app.crunchydeck",
    "electronDownload": { "mirror": "https://github.com/castlabs/electron-releases/releases/download/" },
    "files": ["dist-electron/**", "build/**"],
    "linux": { "target": ["AppImage"], "category": "AudioVideo" }
  }
}
```

- [ ] **Step 4: Write `tsconfig.json` (renderer) and `tsconfig.node.json` (electron)**

`tsconfig.json`:
```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```
`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist-electron",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["electron/**/*.ts"]
}
```

- [ ] **Step 5: Install**

Run: `pnpm install`
Expected: resolves, downloads the castLabs Electron build from the mirror (the `+wvcus` tag).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: project init with castLabs electron + toolchain"
```

---

### Task 2: SvelteKit SPA renderer scaffold

**Files:**
- Create: `svelte.config.js`, `vite.config.ts`, `src/app.html`, `src/routes/+layout.ts`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`

- [ ] **Step 1: Write `svelte.config.js`**

```js
import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' }),
    // relative paths so Electron can load via file://
    paths: { relative: true }
  }
}
```

- [ ] **Step 2: Write `vite.config.ts` (incl. Vitest)**

```ts
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts']
  }
})
```

- [ ] **Step 3: Write `src/app.html`**

```html
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div id="root" data-input="dpad">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 4: Force SPA (no SSR) in `src/routes/+layout.ts`**

```ts
export const ssr = false
export const prerender = false
```

- [ ] **Step 5: Minimal `src/routes/+layout.svelte` and `src/routes/+page.svelte`**

`+layout.svelte`:
```svelte
<script lang="ts">
  import '../app.css'
  let { children } = $props()
</script>

{@render children()}
```
`+page.svelte`:
```svelte
<h1 class="p-8 text-2xl font-bold text-brand">Crunchy Deck — boot OK</h1>
```

- [ ] **Step 6: Verify the web app runs**

Run: `pnpm dev:web`
Expected: dev server at `http://localhost:5173` shows "Crunchy Deck — boot OK". (Styling/`text-brand` lands in Task 13; unstyled is fine here.) Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: sveltekit SPA renderer scaffold"
```

---

### Task 3: Electron main + preload loading the renderer

**Files:**
- Create: `electron/main.ts`, `electron/preload.ts`

- [ ] **Step 1: Write `electron/preload.ts`**

```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('cr', {
  version: process.versions.electron
})
```

- [ ] **Step 2: Write `electron/main.ts`**

```ts
import { app, BrowserWindow } from 'electron'
import path from 'node:path'

const isDev = !!process.env.ELECTRON_RENDERER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  if (isDev) win.loadURL(process.env.ELECTRON_RENDERER_URL!)
  else win.loadFile(path.join(import.meta.dirname, '../build/index.html'))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 3: Build electron + launch the full app**

Run: `pnpm dev`
Expected: an Electron window (1280×800) opens showing "Crunchy Deck — boot OK". Close it.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: electron main+preload load sveltekit renderer"
```

---

### Task 4: Widevine CDM bootstrap + Shaka test-stream playback (M0 proof)

**Files:**
- Modify: `electron/main.ts` (add `components.whenReady()`)
- Create: `src/lib/player/Shaka.svelte`, `src/routes/widevine-test/+page.svelte`

- [ ] **Step 1: Bootstrap the Widevine CDM in `electron/main.ts`**

Replace the `app.whenReady().then(...)` block with one that awaits the castLabs CDM before opening the window:
```ts
import { app, BrowserWindow, components } from 'electron'
import path from 'node:path'

const isDev = !!process.env.ELECTRON_RENDERER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  if (isDev) win.loadURL(process.env.ELECTRON_RENDERER_URL!)
  else win.loadFile(path.join(import.meta.dirname, '../build/index.html'))
}

app.whenReady().then(async () => {
  await components.whenReady() // castLabs: ensures Widevine CDM is downloaded/ready
  console.log('[cdm] components ready:', components.status())
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 2: Write the Shaka surface `src/lib/player/Shaka.svelte`**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import shaka from 'shaka-player/dist/shaka-player.compiled.js'

  let { manifest, license }: { manifest: string; license: string } = $props()
  let video: HTMLVideoElement
  let player: any
  let status = $state('idle')

  onMount(async () => {
    shaka.polyfill.installAll()
    if (!shaka.Player.isBrowserSupported()) { status = 'browser unsupported'; return }
    player = new shaka.Player()
    await player.attach(video)
    player.configure({
      drm: {
        servers: { 'com.widevine.alpha': license },
        advanced: { 'com.widevine.alpha': { videoRobustness: 'SW_SECURE_CRYPTO', audioRobustness: 'SW_SECURE_CRYPTO' } }
      }
    })
    player.addEventListener('error', (e: any) => { status = 'error: ' + e.detail?.code })
    try {
      await player.load(manifest)
      status = 'playing'
      await video.play()
    } catch (e: any) {
      status = 'load failed: ' + (e?.code ?? e)
    }
  })

  onDestroy(() => player?.destroy())
</script>

<div class="flex flex-col gap-2">
  <video bind:this={video} controls class="w-[960px] max-w-full bg-black" data-status={status}></video>
  <p data-testid="shaka-status">status: {status}</p>
</div>
```

- [ ] **Step 3: Write the test page `src/routes/widevine-test/+page.svelte`**

Uses Shaka's public Widevine test asset (Angel One + the permissive CWIP proxy) — proves the CDM pipeline independent of Crunchyroll.
```svelte
<script lang="ts">
  import Shaka from '$lib/player/Shaka.svelte'
  const manifest = 'https://storage.googleapis.com/shaka-demo-assets/angel-one-widevine/dash.mpd'
  const license = 'https://cwip-shaka-proxy.appspot.com/no_auth'
</script>

<div class="p-6">
  <h1 class="mb-4 text-xl font-bold">Widevine M0 spike</h1>
  <Shaka {manifest} {license} />
</div>
```

- [ ] **Step 4: Manual verification (the actual M0 gate)**

Run: `pnpm dev`, then in the app navigate to `http://localhost:5173/widevine-test` (the Electron window can be pointed there, or temporarily set the dev route as home).
Expected: the status line reads **`status: playing`** and the Angel One clip plays with picture + sound. The main-process console prints `[cdm] components ready:` with a Widevine component listed.
- If you get an EME/license error: the dev build likely needs **VMP signing** — do Task 5, package, and retest the packaged build.
- Record the outcome (resolution, any errors) at the top of `scripts/sign-vmp.md`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(m0): widevine CDM bootstrap + shaka test-stream playback"
```

---

### Task 5: VMP signing runbook (castLabs EVS)

**Files:**
- Create: `scripts/sign-vmp.md`

Some license servers refuse unsigned builds (Verified Media Path). This documents the signing path; it requires a free castLabs EVS account, so it is a runbook, not an automated test.

- [ ] **Step 1: Write `scripts/sign-vmp.md`**

```markdown
# Widevine VMP signing (castLabs EVS)

The castLabs Electron fork ships the CDM, but premium license servers require the
packaged app to be VMP-signed or they deny license requests.

## One-time
1. `pip install castlabs-evs`
2. `python -m castlabs_evs.account signup`   # or `reauth` (free dev account)

## Per release (after `pnpm build` + electron-builder produces the unpacked app)
3. Sign the packaged directory:
   `python -m castlabs_evs.vmp sign-pkg release/linux-unpacked`   # Linux
   `python -m castlabs_evs.vmp sign-pkg release/win-unpacked`     # Windows dev
4. Re-package the signed dir into the final artifact.

## M0 result log
- Date / OS / signed?:
- Test stream played: yes/no, resolution:
- Errors:
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "docs: add VMP signing runbook"
```

---

## Part B — Native-Feel Shell Core (M1 core)

> The next tasks are pure-logic-first (TDD) because the "native feel" lives in math (nearest-in-direction) and timing (hysteresis + accelerating repeat) that is fully unit-testable without a browser.

### Task 6: Vitest smoke

**Files:**
- Create: `src/lib/input/spatial.test.ts` (temporary smoke, replaced in Task 7)

- [ ] **Step 1: Write a trivial passing test**

```ts
import { describe, it, expect } from 'vitest'
describe('vitest', () => { it('runs', () => { expect(1 + 1).toBe(2) }) })
```

- [ ] **Step 2: Run it**

Run: `pnpm test`
Expected: 1 passing test.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: vitest smoke"
```

---

### Task 7: Spatial-navigation core math (TDD)

**Files:**
- Create: `src/lib/input/spatial.ts`
- Replace: `src/lib/input/spatial.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { nearestInDirection, type Focusable } from './spatial'

// 2x2 grid:  A B
//            C D
const grid: Focusable[] = [
  { id: 'A', rect: { x: 0,   y: 0,   width: 100, height: 100 } },
  { id: 'B', rect: { x: 200, y: 0,   width: 100, height: 100 } },
  { id: 'C', rect: { x: 0,   y: 200, width: 100, height: 100 } },
  { id: 'D', rect: { x: 200, y: 200, width: 100, height: 100 } }
]

describe('nearestInDirection', () => {
  it('moves right to the immediate neighbor', () => {
    expect(nearestInDirection('A', grid, 'right')).toBe('B')
  })
  it('moves down to the element below, not diagonal', () => {
    expect(nearestInDirection('A', grid, 'down')).toBe('C')
  })
  it('returns null at the edge', () => {
    expect(nearestInDirection('B', grid, 'right')).toBeNull()
  })
  it('prefers the nearer of two candidates in-line', () => {
    const row: Focusable[] = [
      { id: 'A', rect: { x: 0,   y: 0, width: 50, height: 50 } },
      { id: 'B', rect: { x: 100, y: 0, width: 50, height: 50 } },
      { id: 'C', rect: { x: 400, y: 0, width: 50, height: 50 } }
    ]
    expect(nearestInDirection('A', row, 'right')).toBe('B')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — `nearestInDirection` not found.

- [ ] **Step 3: Implement `src/lib/input/spatial.ts`**

```ts
export interface Rect { x: number; y: number; width: number; height: number }
export interface Focusable { id: string; rect: Rect }
export type Direction = 'up' | 'down' | 'left' | 'right'

function center(r: Rect) {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

// unit vector per direction (screen coords: +y is down)
const AXIS: Record<Direction, { x: number; y: number }> = {
  up:    { x: 0,  y: -1 },
  down:  { x: 0,  y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1,  y: 0 }
}

const CONE = Math.PI / 2.4 // ~75° half-cone: stay roughly on-axis

export function nearestInDirection(
  currentId: string,
  candidates: Focusable[],
  direction: Direction
): string | null {
  const current = candidates.find((c) => c.id === currentId)
  if (!current) return null
  const from = center(current.rect)
  const axis = AXIS[direction]

  let best: { id: string; score: number } | null = null
  for (const cand of candidates) {
    if (cand.id === currentId) continue
    const to = center(cand.rect)
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.hypot(dx, dy)
    if (dist === 0) continue
    // angle between the candidate vector and the direction axis
    const dot = (dx * axis.x + dy * axis.y) / dist
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
    if (angle > CONE) continue // outside the directional cone -> not a candidate
    // score: distance, penalized for being off-axis
    const score = dist * (1 + angle)
    if (!best || score < best.score) best = { id: cand.id, score }
  }
  return best ? best.id : null
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(input): spatial nearest-in-direction core (TDD)"
```

---

### Task 8: Per-element navigation overrides (TDD)

Hand-tuned paths (sidebar, player chrome) need explicit overrides that win over geometry.

**Files:**
- Modify: `src/lib/input/spatial.ts`
- Modify: `src/lib/input/spatial.test.ts`

- [ ] **Step 1: Add failing test**

Append:
```ts
import { resolveOverride } from './spatial'

describe('resolveOverride', () => {
  it('returns the override target id when present', () => {
    const overrides = { right: 'PLAY' }
    expect(resolveOverride(overrides, 'right')).toBe('PLAY')
  })
  it('returns null when no override for that direction', () => {
    expect(resolveOverride({ up: 'X' }, 'down')).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`resolveOverride` not found). Run: `pnpm test`

- [ ] **Step 3: Implement** — append to `spatial.ts`:

```ts
export type Overrides = Partial<Record<Direction, string>>

export function resolveOverride(overrides: Overrides, direction: Direction): string | null {
  return overrides[direction] ?? null
}
```

- [ ] **Step 4: Run — expect PASS.** Run: `pnpm test`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(input): per-element nav overrides (TDD)"
```

---

### Task 9: DOM navigation wrapper

Bridges pure math to the live DOM: collects focusables, reads `data-{up,down,left,right}` overrides, moves focus, and keeps the focused element centered and never-null.

**Files:**
- Create: `src/lib/input/navigate.ts`
- Create: `src/lib/input/navigate.test.ts`

- [ ] **Step 1: Write the jsdom test**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { focusables, moveFocus } from './navigate'

function el(id: string, x: number, y: number) {
  const d = document.createElement('button')
  d.id = id
  d.setAttribute('data-focusable', '')
  d.tabIndex = 0
  // jsdom has no layout: stub getBoundingClientRect
  d.getBoundingClientRect = () => ({ x, y, width: 100, height: 100, top: y, left: x, right: x + 100, bottom: y + 100, toJSON() {} }) as DOMRect
  document.body.appendChild(d)
  return d
}

describe('navigate (dom)', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('collects elements marked data-focusable', () => {
    el('A', 0, 0); el('B', 200, 0)
    expect(focusables().map((f) => f.id).sort()).toEqual(['A', 'B'])
  })

  it('moveFocus moves focus to the right neighbor', () => {
    const a = el('A', 0, 0); el('B', 200, 0)
    a.focus()
    moveFocus('right')
    expect(document.activeElement?.id).toBe('B')
  })

  it('moveFocus honors a data-override', () => {
    const a = el('A', 0, 0); el('B', 200, 0); el('Z', 0, 400)
    a.setAttribute('data-down', '#Z')
    a.focus()
    moveFocus('down')
    expect(document.activeElement?.id).toBe('Z')
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** Run: `pnpm test`

- [ ] **Step 3: Implement `src/lib/input/navigate.ts`**

```ts
import { nearestInDirection, resolveOverride, type Direction, type Focusable, type Overrides } from './spatial'

export function focusables(scope: ParentNode = document): Focusable[] {
  return Array.from(scope.querySelectorAll<HTMLElement>('[data-focusable]'))
    .filter((e) => e.offsetParent !== null || e.getClientRects().length > 0)
    .map((e) => {
      const r = e.getBoundingClientRect()
      return { id: e.id, rect: { x: r.x, y: r.y, width: r.width, height: r.height } }
    })
}

function readOverrides(e: HTMLElement): Overrides {
  const o: Overrides = {}
  for (const d of ['up', 'down', 'left', 'right'] as Direction[]) {
    const sel = e.getAttribute(`data-${d}`)
    if (sel) {
      const t = document.querySelector<HTMLElement>(sel)
      if (t?.id) o[d] = t.id
    }
  }
  return o
}

export function moveFocus(direction: Direction): boolean {
  const active = document.activeElement as HTMLElement | null
  if (!active || !active.id) {
    const first = document.querySelector<HTMLElement>('[data-focusable]')
    first?.focus()
    return !!first
  }
  const override = resolveOverride(readOverrides(active), direction)
  const targetId = override ?? nearestInDirection(active.id, focusables(), direction)
  if (!targetId) return false
  const target = document.getElementById(targetId)
  if (!target) return false
  target.focus()
  target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  return true
}

// never-null guard: call from an interval/rAF in the app shell
export function ensureFocus() {
  const a = document.activeElement
  if (!a || a === document.body) {
    document.querySelector<HTMLElement>('[data-focusable]')?.focus()
  }
}
```

- [ ] **Step 4: Run — expect PASS.** Run: `pnpm test`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(input): DOM navigation wrapper with overrides + center-scroll"
```

---

### Task 10: Gamepad → NavCommand mapping + axis hysteresis (TDD)

**Files:**
- Create: `src/lib/input/gamepad.ts`
- Create: `src/lib/input/gamepad.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buttonToCommand, AxisTracker } from './gamepad'

describe('buttonToCommand', () => {
  it('maps standard buttons', () => {
    expect(buttonToCommand(0)).toBe('confirm') // A
    expect(buttonToCommand(1)).toBe('cancel')  // B
    expect(buttonToCommand(4)).toBe('prev')    // LB
    expect(buttonToCommand(5)).toBe('next')    // RB
    expect(buttonToCommand(9)).toBe('menu')    // Start
    expect(buttonToCommand(12)).toBe('up')
    expect(buttonToCommand(15)).toBe('right')
  })
  it('returns null for unmapped buttons', () => {
    expect(buttonToCommand(16)).toBeNull()
  })
})

describe('AxisTracker hysteresis', () => {
  it('fires once when crossing the press threshold and not again until release', () => {
    const t = new AxisTracker(0.5, 0.3)
    expect(t.update(0, 0.2)).toBeNull()        // below press
    expect(t.update(0, 0.6)).toBe('right')     // cross press -> fire
    expect(t.update(0, 0.7)).toBeNull()        // still held -> no refire
    expect(t.update(0, 0.35)).toBeNull()       // above release -> still held
    expect(t.update(0, 0.1)).toBeNull()        // below release -> reset (no fire)
    expect(t.update(0, 0.6)).toBe('right')     // press again -> fire
  })
  it('uses the dominant axis', () => {
    const t = new AxisTracker(0.5, 0.3)
    expect(t.update(0.1, -0.9)).toBe('up')     // y dominates, negative = up
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** Run: `pnpm test`

- [ ] **Step 3: Implement `src/lib/input/gamepad.ts`** (mapping + tracker only — poller in Task 12)

```ts
export type NavCommand =
  | 'up' | 'down' | 'left' | 'right'
  | 'confirm' | 'cancel' | 'next' | 'prev' | 'menu' | 'search'
export type Direction = 'up' | 'down' | 'left' | 'right'

const BUTTON_MAP: Record<number, NavCommand> = {
  0: 'confirm', // A
  1: 'cancel',  // B
  4: 'prev',    // LB
  5: 'next',    // RB
  8: 'search',  // Back/Select
  9: 'menu',    // Start
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right'
}

export function buttonToCommand(index: number): NavCommand | null {
  return BUTTON_MAP[index] ?? null
}

// Treats an analog stick as a d-pad with separate press/release thresholds.
export class AxisTracker {
  private pressed = false
  constructor(private press = 0.5, private release = 0.3) {}

  update(x: number, y: number): Direction | null {
    const mag = Math.hypot(x, y)
    if (this.pressed) {
      if (mag < this.release) this.pressed = false
      return null
    }
    if (mag < this.press) return null
    this.pressed = true
    return Math.abs(x) >= Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up')
  }
}
```

- [ ] **Step 4: Run — expect PASS.** Run: `pnpm test`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(input): gamepad mapping + axis hysteresis (TDD)"
```

---

### Task 11: Accelerating key-repeat (TDD)

Held directions repeat: an initial delay, then an interval that ramps faster the longer it is held.

**Files:**
- Create: `src/lib/input/repeat.ts`
- Create: `src/lib/input/repeat.test.ts`

- [ ] **Step 1: Write the failing test (injected clock)**

```ts
import { describe, it, expect } from 'vitest'
import { RepeatTimer } from './repeat'

describe('RepeatTimer', () => {
  it('fires immediately, waits the initial delay, then ramps', () => {
    // initialDelay 320ms, start 120ms ramping to 45ms over 1000ms
    const t = new RepeatTimer({ initialDelay: 320, startInterval: 120, minInterval: 45, ramp: 1000 })
    expect(t.press(0)).toBe(true)        // first press fires
    expect(t.tick(100)).toBe(false)      // within initial delay
    expect(t.tick(320)).toBe(true)       // initial delay elapsed -> fire #2
    expect(t.tick(420)).toBe(false)      // <120ms since last
    expect(t.tick(440)).toBe(true)       // 120ms since last -> fire #3
  })
  it('release stops repeats', () => {
    const t = new RepeatTimer({ initialDelay: 320, startInterval: 120, minInterval: 45, ramp: 1000 })
    t.press(0)
    t.release()
    expect(t.tick(1000)).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** Run: `pnpm test`

- [ ] **Step 3: Implement `src/lib/input/repeat.ts`**

```ts
export interface RepeatConfig {
  initialDelay: number
  startInterval: number
  minInterval: number
  ramp: number // ms over which interval eases from start -> min
}

export class RepeatTimer {
  private heldSince: number | null = null
  private lastFire = 0
  constructor(private cfg: RepeatConfig) {}

  press(now: number): boolean {
    this.heldSince = now
    this.lastFire = now
    return true
  }

  release() {
    this.heldSince = null
  }

  private intervalAt(now: number): number {
    const held = now - (this.heldSince ?? now)
    const elapsed = Math.max(0, held - this.cfg.initialDelay)
    const f = Math.min(1, elapsed / this.cfg.ramp)
    return this.cfg.startInterval + (this.cfg.minInterval - this.cfg.startInterval) * f
  }

  tick(now: number): boolean {
    if (this.heldSince === null) return false
    const sinceHold = now - this.heldSince
    if (sinceHold < this.cfg.initialDelay) return false
    if (now - this.lastFire >= this.intervalAt(now) - 1e-6) {
      this.lastFire = now
      return true
    }
    return false
  }
}
```

- [ ] **Step 4: Run — expect PASS.** Run: `pnpm test`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(input): accelerating key-repeat timer (TDD)"
```

---

### Task 12: Gamepad poller + inputType store (wiring)

Polls gamepads each frame, turns the mapping/tracker/repeat into `moveFocus`/command dispatch, and tracks the active input modality.

**Files:**
- Create: `src/lib/input/inputType.ts`
- Create: `src/lib/input/poller.ts`
- Modify: `src/routes/+layout.svelte` (start the poller, run `ensureFocus`)

- [ ] **Step 1: `src/lib/input/inputType.ts`**

```ts
import { writable } from 'svelte/store'

export type InputType = 'dpad' | 'mouse' | 'touch'
export const inputType = writable<InputType>('dpad')

export function setInputType(t: InputType) {
  inputType.set(t)
  document.getElementById('root')?.setAttribute('data-input', t)
}
```

- [ ] **Step 2: `src/lib/input/poller.ts`**

```ts
import { moveFocus } from './navigate'
import { buttonToCommand, AxisTracker, type NavCommand, type Direction } from './gamepad'
import { RepeatTimer } from './repeat'
import { setInputType } from './inputType'

type CommandHandler = (cmd: NavCommand) => void

export function startGamepadPoller(onCommand: CommandHandler) {
  const axis = new AxisTracker(0.5, 0.3)
  const repeat = new RepeatTimer({ initialDelay: 320, startInterval: 120, minInterval: 45, ramp: 1000 })
  const prevButtons = new Map<number, boolean>()
  let heldDir: Direction | null = null
  let raf = 0

  const now = () => performance.now()

  const dispatch = (cmd: NavCommand) => {
    if (cmd === 'up' || cmd === 'down' || cmd === 'left' || cmd === 'right') moveFocus(cmd)
    else onCommand(cmd)
  }

  const loop = () => {
    const pads = navigator.getGamepads?.() ?? []
    for (const pad of pads) {
      if (!pad) continue
      setInputType('dpad')

      // buttons: fire on rising edge
      pad.buttons.forEach((b, i) => {
        const pressed = b.pressed
        if (pressed && !prevButtons.get(i)) {
          const cmd = buttonToCommand(i)
          if (cmd) dispatch(cmd)
        }
        prevButtons.set(i, pressed)
      })

      // left stick -> direction with hysteresis + repeat
      const dir = axis.update(pad.axes[0] ?? 0, pad.axes[1] ?? 0)
      if (dir) { heldDir = dir; repeat.press(now()); dispatch(dir) }
      const mag = Math.hypot(pad.axes[0] ?? 0, pad.axes[1] ?? 0)
      if (mag < 0.3) { heldDir = null; repeat.release() }
      if (heldDir && repeat.tick(now())) dispatch(heldDir)
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  return () => cancelAnimationFrame(raf)
}
```

- [ ] **Step 3: Start it in `src/routes/+layout.svelte`**

```svelte
<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { startGamepadPoller } from '$lib/input/poller'
  import { ensureFocus } from '$lib/input/navigate'
  let { children } = $props()

  onMount(() => {
    const stop = startGamepadPoller((cmd) => {
      if (cmd === 'cancel') history.back()
    })
    const id = setInterval(ensureFocus, 500)
    // keyboard fallback so it is testable without a controller
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, () => void> = {
        ArrowUp: () => import('$lib/input/navigate').then((m) => m.moveFocus('up')),
        ArrowDown: () => import('$lib/input/navigate').then((m) => m.moveFocus('down')),
        ArrowLeft: () => import('$lib/input/navigate').then((m) => m.moveFocus('left')),
        ArrowRight: () => import('$lib/input/navigate').then((m) => m.moveFocus('right'))
      }
      map[e.key]?.()
    }
    window.addEventListener('keydown', onKey)
    return () => { stop(); clearInterval(id); window.removeEventListener('keydown', onKey) }
  })
</script>

{@render children()}
```

- [ ] **Step 4: Type-check**

Run: `pnpm check`
Expected: no errors. (Fix any import/type issues surfaced.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(input): gamepad poller + inputType store wired into shell"
```

---

### Task 13: Design tokens, fonts, and the `select` (hover≡focus) variant

**Files:**
- Create: `tailwind.config.ts`, `postcss.config.js`
- Replace: `src/app.css`

- [ ] **Step 1: `postcss.config.js`**

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

- [ ] **Step 2: `tailwind.config.ts`** — CR brand tokens + the `select` variant

```ts
import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

export default {
  content: ['./src/**/*.{html,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: '#F47521',          // Crunchyroll orange
        surface: {
          DEFAULT: '#0a0a0a',
          1: '#141414',
          2: '#1e1e1e',
          3: '#2a2a2a'
        }
      },
      fontFamily: {
        sans: ['Nunito Variable', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace']
      },
      borderRadius: { card: '0.75rem' }
    }
  },
  plugins: [
    // `select:` = hover OR keyboard/controller focus OR active -> one visual system
    plugin(({ addVariant }) => {
      addVariant('select', ['&:hover', '&:focus-visible', '&:focus', '&:active'])
      addVariant('group-select', [
        ':merge(.group):hover &',
        ':merge(.group):focus-visible &',
        ':merge(.group):focus &'
      ])
    })
  ]
} satisfies Config
```

- [ ] **Step 3: `src/app.css`** — fonts, base, global focus

```css
@import '@fontsource-variable/nunito';
@import '@fontsource/geist-mono';
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: only dark; }

html, body { height: 100%; }
body {
  @apply bg-surface text-white font-sans;
  overflow: hidden;
}

/* always-obvious focus for controller use */
[data-input='dpad'] [data-focusable]:focus {
  outline: 3px solid theme('colors.brand');
  outline-offset: 2px;
}

/* hide scrollbars (10-foot UI) */
*::-webkit-scrollbar { display: none; }
* { scrollbar-width: none; }
```

- [ ] **Step 4: Install the font packages**

Run: `pnpm add @fontsource-variable/nunito @fontsource/geist-mono`

- [ ] **Step 5: Verify styling**

Run: `pnpm dev:web`
Expected: home text now renders in Nunito on a near-black background; `text-brand` is Crunchyroll orange. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): design tokens, Nunito font, select hover≡focus variant"
```

---

### Task 14: Demo screen — gamepad-navigable focusable grid (the feel-check)

A row of poster cards (mock data) that you can traverse with the left stick / d-pad / arrow keys; the focused card centers itself and scales up with motion. This is the M1 "does it feel native" gate.

**Files:**
- Create: `src/lib/ui/Card.svelte`
- Create: `src/routes/demo/+page.svelte`

- [ ] **Step 1: `src/lib/ui/Card.svelte`**

```svelte
<script lang="ts">
  let { id, title }: { id: string; title: string } = $props()
</script>

<button
  {id}
  data-focusable
  class="group relative h-[290px] w-[195px] shrink-0 overflow-hidden rounded-card bg-surface-2
         transition-transform duration-150 ease-out outline-none
         select:scale-105 select:shadow-2xl select:shadow-black/60"
>
  <div class="flex h-full w-full items-end bg-gradient-to-t from-black/70 to-surface-3 p-3">
    <span class="text-left text-sm font-bold leading-tight">{title}</span>
  </div>
  <div class="pointer-events-none absolute inset-0 rounded-card ring-0 ring-brand
              transition-all group-select:ring-4"></div>
</button>
```

- [ ] **Step 2: `src/routes/demo/+page.svelte`**

```svelte
<script lang="ts">
  import Card from '$lib/ui/Card.svelte'
  import { onMount } from 'svelte'
  import { moveFocus } from '$lib/input/navigate'

  const rows = [
    { title: 'Continue Watching', items: Array.from({ length: 12 }, (_, i) => ({ id: `cw-${i}`, title: `Series ${i + 1}` })) },
    { title: 'Popular', items: Array.from({ length: 12 }, (_, i) => ({ id: `pop-${i}`, title: `Popular ${i + 1}` })) },
    { title: 'Newly Added', items: Array.from({ length: 12 }, (_, i) => ({ id: `new-${i}`, title: `New ${i + 1}` })) }
  ]

  onMount(() => { document.querySelector<HTMLElement>('[data-focusable]')?.focus() })
</script>

<div class="h-screen overflow-y-auto p-10">
  <h1 class="mb-8 text-3xl font-black text-brand">Crunchy Deck</h1>
  {#each rows as row}
    <section class="mb-10">
      <h2 class="mb-3 text-lg font-bold text-white/80">{row.title}</h2>
      <div class="flex gap-4 overflow-x-auto pb-4">
        {#each row.items as item}
          <Card id={item.id} title={item.title} />
        {/each}
      </div>
    </section>
  {/each}
</div>
```

- [ ] **Step 3: Make `demo` the default route for now**

Edit `src/routes/+page.svelte` to redirect:
```svelte
<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  onMount(() => goto('/demo'))
</script>
```

- [ ] **Step 4: Manual feel-check (M1 gate)**

Run: `pnpm dev`
Expected in the Electron window:
- Three rows of cards render.
- Arrow keys (and a connected controller's d-pad/left stick) move focus; the focused card **scales up, shows a brand-orange ring, and scrolls to center** smoothly.
- Holding a direction repeats with acceleration (slow → fast).
- `B` / browser back does nothing harmful (single screen).
Confirm it feels responsive (no lag, no overshoot). Note any jank for the polish milestone.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ui): gamepad-navigable demo grid with centered-focus motion"
```

---

## Self-Review

**Spec coverage (this plan = M0 + M1 core):**
- M0 Widevine spike → Tasks 4–5 ✓ (CDM bootstrap, Shaka test stream, VMP runbook)
- Runtime = castLabs Electron + SvelteKit + Shaka → Tasks 1–4 ✓
- Spatial nav + full gamepad + hysteresis + accel-repeat + never-null focus → Tasks 7–12 ✓
- `select` hover≡focus, high-contrast focus, design tokens, Nunito font → Task 13 ✓
- Centered-focus + scale motion, virtualizable rows → Task 14 ✓
- **Deferred to later plans (correctly out of scope here):** device-flow QR auth (M2), real CR API data (M3), full player chrome (M4), Flatpak/Gamescope/VAAPI/controller template (M5), full design system + per-series accent + empty/error states (M6). Listed so the gap is intentional, not missed.

**Placeholder scan:** none — every code/test step contains runnable content; the only `.md`-with-blanks is the VMP result log, which is intentional runtime data.

**Type consistency:** `Direction`, `NavCommand`, `Focusable`, `Overrides` shared across `spatial.ts`/`gamepad.ts`/`navigate.ts`; `moveFocus(Direction)`, `nearestInDirection(id, candidates, Direction)`, `RepeatTimer.tick(now)` signatures match every call site (poller, layout, tests). `AxisTracker(press, release)` constructor matches usage.

---

## Notes for the executor

- **M0 is the real risk.** If Task 4 manual playback fails even after VMP signing (Task 5), stop and report — the whole architecture depends on it, and we'd reassess before building further.
- The keyboard-arrow fallback in Task 12 means every input task is verifiable on Windows without a controller; a controller just exercises the same `moveFocus`/command path.
- Svelte 5 runes (`$props`, `$state`) are used; ensure `svelte@^5`.
