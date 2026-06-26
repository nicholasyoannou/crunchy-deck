# Crunchy Deck — Native Steam Deck Crunchyroll Client

**Status:** Draft for review · **Date:** 2026-06-26
**Codename:** Crunchy Deck *(working name — changeable)*

A controller-first, native-feeling Crunchyroll client built for the Steam Deck. It is **not** a webview of `crunchyroll.com`: it is a fully custom 10-foot UI whose look, navigation, and motion are designed for a 1280×800 handheld driven by sticks and buttons. DRM video plays through the legitimate, VMP-signed Widevine CDM shipped by the castLabs Electron fork.

---

## 1. Goals & Non-Goals

### Goals (in priority order, per user)
1. **UI/UX that feels genuinely native on the Deck** — stick/d-pad navigation, focus that glides, custom menus, smooth animations. The feel *is* the product.
2. **Fast, performant, optimized** for the Deck's hardware and battery (60 fps navigation, virtualized lists, GPU-only transforms, hardware video decode).
3. **Easy to use** — couch-friendly, no typing where avoidable (QR/device login), large targets, always-obvious focus, instant feedback.
4. **Steam Deck compatible out of the box** — installs from Flatpak, runs in Gaming Mode/Gamescope, full controller support with a shipped Steam Input template.
5. Full Crunchyroll experience: Home feed, Browse, Search, Watchlist, Series/Episode details, Account, and a first-class video player.

### Non-Goals (YAGNI)
- No DRM circumvention. We use the official signed CDM; quality is L3-capped (~480–720p) and that is accepted.
- No mobile/phone or Windows/macOS target in v1. Linux/Deck only. (Stack keeps the door open, but we will not test or polish other platforms.)
- No Funimation migration, no Watch-Together (W2G), no chat, no kids-profile PIN management in v1.
- No offline downloads in v1.
- No custom backend/server. The app talks directly to Crunchyroll's services.

### Explicit risk acknowledged by the user
This client talks to Crunchyroll's **private API** (same as the `crunchyroll-linux` project being forked from). This likely violates Crunchyroll's ToS and the borrowed client credentials can be revoked. This is a personal-use unofficial client; the risk is accepted and owned by the project. We isolate the API contract behind one module so a credential/endpoint change is a one-file fix.

---

## 2. Architecture Overview

Single Electron app. One main process, one renderer (the UI), plus a thin preload bridge.

```
┌──────────────────────────────────────────────────────────────┐
│ castLabs Electron (Widevine wvcus fork)                       │
│                                                               │
│  Main process (Node)                                          │
│   • window/lifecycle, Gamescope-friendly fullscreen           │
│   • Widevine CDM bootstrap (components.whenReady)              │
│   • secure token storage (OS keyring via keytar/safeStorage)  │
│   • VAAPI / GPU flags, power/suspend handling                 │
│   • Crunchyroll API proxy (avoids CORS, hides headers)        │
│         ▲  IPC (contextBridge, typed)                         │
│         ▼                                                     │
│  Renderer = SvelteKit SPA (adapter-static)                    │
│   • Design system + screens (Home/Browse/Search/Details/…)    │
│   • Spatial-navigation + gamepad input engine                 │
│   • Shaka Player surface (EME → CDM) for video                │
└──────────────────────────────────────────────────────────────┘
```

**Why this shape:** the castLabs fork is the only runtime that legally decrypts Crunchyroll's Widevine streams on Linux, and it hosts both our native UI and the Shaka player in the *same* renderer — no separate video subprocess, no compositing two surfaces. The UI never loads a Crunchyroll web page; it renders our own components from JSON.

### Process responsibilities
- **Main:** all privileged work — keyring access, the Crunchyroll HTTP calls (so we control headers/User-Agent and dodge browser CORS), Widevine init, GPU/codec flags, window + Gamescope behavior, deep-link/`crunchyroll://` handling for the login callback if used.
- **Preload:** a small, typed `contextBridge` API (`window.cr`) exposing `api.*` (data), `auth.*` (login/token), `player.*` (license requests if proxied), `system.*` (power, version). No `nodeIntegration` in the renderer.
- **Renderer:** pure UI + input + playback. No Node access; talks to main only through the bridge.

---

## 3. Tech Stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Runtime | **castLabs Electron** (`electron-releases#…+wvcus`) | Only legal Widevine-on-Linux path; proven by base project |
| UI framework | **Svelte 5 + SvelteKit 2** (SPA, `adapter-static`) | Lets us fork Hayase's nav/gamepad core verbatim; compiled, lean, great for the Deck |
| Language | **TypeScript** (strict) | Safety across IPC + API contract |
| Build | **Vite 7** | Fast HMR, SvelteKit default |
| Styling | **Tailwind CSS** + **shadcn-svelte / bits-ui** | Accessible, focus-managed primitives; token system; `select` variant |
| Player | **Shaka Player** (DASH/HLS via MSE-EME) | Key-system-agnostic; delegates decryption to the CDM |
| Icons | **lucide-svelte** + Crunchyroll nav icon set (from APK) | Familiar glyphs + brand nav icons |
| Packaging | **Flatpak** (primary) + electron-builder | Survives SteamOS updates; Discover-installable |
| Token storage | OS keyring (`keytar`/Electron `safeStorage`) | Never store plaintext passwords (base project's sin) |

**Framework note:** Svelte 5 with `runes` enabled for new code. Hayase's nav modules are ~95% framework-agnostic DOM/`KeyboardEvent` code wrapped in Svelte actions; we lift them and modernize as needed.

---

## 4. Design System

Derived from the official Crunchyroll Android app (Material 3 + custom brand) for authenticity, then tuned for a 10-foot handheld and enriched with Hayase's best theming ideas.

### Color
- **Brand accent:** Crunchyroll orange `#F47521` (primary actions, focus accents, progress).
- **Surfaces:** deep near-black base (dark theme only — `color-scheme: only dark`), layered Material-3-style surface containers for elevation. White/high-emphasis text on dark.
- **Per-series dynamic accent (from Hayase):** a `--custom` CSS variable themes each series' detail page and player from its key art, with a luminance-computed `.text-contrast` util so text stays readable on any accent. High-impact, low-cost polish.
- **Semantic:** error/disabled/success tokens mirroring the APK's Material 3 token names.

### Typography
- **Body/UI + display:** **Nunito Variable** (Hayase's UI face — closer to the Crunchyroll web feel than the Android-TV fonts, which the user found weak). Tabular/mono via **Geist Mono** for durations/counts.
- **CR wordmark:** the official logo lockup is its own art asset; ATyp from the APK is kept only as an optional accent face if we later want brand headers.
- **CJK/Thai fallback:** Noto.
- *(Typography is intentionally easy to swap — treated as a tunable token, not a hard dependency.)*
- **10-foot scaling:** base font sized up vs. desktop; a global `uiScale` setting (Hayase has this) maps to a root rem scale so users can dial legibility. Minimum readable size enforced (no <14px text anywhere — the APK/Hayase both have unusable 6–10px labels we will not copy).

### Spacing, shape, motion
- 8px spacing grid; generous padding (overscan-safe insets via a safe-area pad).
- Rounded cards (Material-3 feel), soft shadows for elevation, accent ring for focus.
- **Motion language:** quick and physical. Focus moves with a 120–180ms ease; cards scale `1.0→1.05` + shadow on focus; page changes use the **View Transitions API** (cross-fade/shared-element) with `prefers-reduced-motion` honored. All animation via GPU transforms/opacity only.

### Brand assets
- App icon + wordmark (CR logo), and the **Hime mascot** illustrations (splash, empty states, errors, login) extracted from the APK — used for personality in empty/loading/error screens exactly as the official app does.

---

## 5. Navigation & Input Model — the heart of the app

This is where "native feel" lives. We adopt the **gamepad → directional key → spatial-navigation engine** pattern proven by both Hayase and dusklight (translating the controller into synthetic directional keys is *correct* precisely because a real spatial engine consumes them — the failure mode in `crunchyroll-linux` was the absence of that engine).

### Layers
1. **`gamepad.ts` (forked from Hayase, extended):** polls `navigator.getGamepads()` each rAF; maps the **full** controller:
   - Left stick + d-pad → directional nav (analog treated as d-pad with **hysteresis**, press/release thresholds, so no jitter or diagonal noise)
   - A → Confirm/Enter, B → Cancel/Back, X/Y → contextual actions (e.g. X = add to watchlist, Y = play)
   - L1/R1 → section/tab jump (page-left/right), L2/R2 → reserved (e.g. fast-seek in player)
   - Start → menu, Select → search
   - **Accelerating key-repeat** for held directions (initial delay ~320ms → ramps to ~45ms) so long catalogs travel fast without overshoot.
2. **`navigate.ts` (forked from Hayase):** the spatial engine — from the focused element, compute angle (`atan2`) + distance (`hypot`) to all focusable elements and move to the nearest in the pressed direction. Supports per-element overrides via `data-up/down/left/right` selectors for hand-tuned paths (sidebar, player chrome). Focused element always `scrollIntoView({block:'center'})`. **Focus is never allowed to become null** (re-focus the top container if lost — dusklight rule).
3. **`inputType` store (`'dpad' | 'mouse' | 'touch'`):** written to `data-input` on root; **defaults to `dpad` on the Deck** (new vs. Hayase, which defaults to touch). The `select` Tailwind variant makes hover and controller-focus share identical styling — one visual system for all inputs, no duplicate focus CSS.

### Global conventions (consistency = ease of use)
- **B is always Back/Up** everywhere; B closes any open overlay, else navigates route-back (new vs. Hayase, which only maps B→Escape).
- **A is always Confirm.** Start always opens the app menu; Select always opens Search.
- **High-contrast, always-visible focus** (accent ring + scale), not Hayase's deliberately faint ring — controller UX needs the cursor to be unmistakable.
- Modal focus-trapping: spatial nav scopes candidates to the topmost `[role=dialog]`/`[role=application]`.
- **Audio + haptic feedback** on focus move / confirm / cancel (subtle), for the console "tactile" feel dusklight uses.
- Touchscreen and the Deck trackpads still work (mouse/touch input types) — controller is primary, not exclusive.

---

## 6. Screens & Information Architecture

Left **icon rail** (vertical nav) — Home · Browse · Search · Watchlist · Account — mirroring the APK's tabs adapted to a TV-style side rail (better for 16:10 + thumb reach). L1/R1 jumps between rails/sections.

### 6.1 Login / Onboarding (QR device flow)
- Splash (Hime) → if no token, **QR login screen**: large QR of the device-activation URL + the human-readable code, 3-step instructions ("Scan with your phone → confirm → stay on this screen"), live "waiting…" state. Mirrors the official app's QR sign-in exactly.
- Implements **OAuth 2.0 Device Authorization Grant (RFC 8628)** against Crunchyroll's `/activate` device flow: request `device_code`+`user_code`+`verification_uri_complete`, render QR of the complete URI, poll the token endpoint at the returned `interval`, handle `authorization_pending`/`slow_down`/`expired_token` (regenerate code). No password typing.
- On success: store access/refresh tokens in the OS keyring; route to Home.

### 6.2 Home
- **Hero banner** (full-bleed key art, fades on scroll, vignette for legibility) for a featured/continue item.
- **Horizontal carousels**, one per row, matching the APK's feed: **Continue Watching** (with resume progress + "Up Next"), Popular, Newly Added, Trending, Coming Soon, plus genre rows. Row titles are "View More" entry points.
- Cards: poster art, title, progress pip; focus → scale + richer preview (synopsis, rating, quick actions). Virtualized (`content-visibility`/windowing); thumbnails lazy-loaded; skeleton placeholders on load.

### 6.3 Browse
- Filterable grid (genre/season/sort: Alphabetical · Newly Added · Popular), header chips, empty/loading states (Hime art). Grid sized for 1280×800 (larger posters, ~4–5 across, 2-up minimum).

### 6.4 Search
- Opened by Select anywhere. Command-palette-style overlay (cmdk pattern) with the Steam OSK or an on-screen grid keyboard; live results as rich rows; recent/clear. Voice search out of scope v1.

### 6.5 Series / Episode details
- Hero + per-series accent theming. Tabs: **Episodes** (default) · Seasons · Related · About. Episode list: responsive grid, watched dimming, current/filler ringing, resume bar, focus → scale + play overlay. Primary CTAs: **Watch / Resume** (Y), **Add to Watchlist** (X). Spoiler synopsis blurred until focused.

### 6.6 Player — first-class
- Adapts Hayase's excellent player chrome to Crunchyroll + controller:
  - Bottom gradient overlay that **auto-hides after ~3s idle**, reappears on any input. Generous 48px controls.
  - **Chapter-segmented seekbar** with thumbnail preview; L2/R2 or stick = scrub; A = play/pause.
  - **Skip Intro / Skip Recap / Next Episode** prompts (Crunchyroll provides skip markers); "Up Next" auto-advance with countdown.
  - Options tree: **quality, subtitle track, audio/dub track, playback speed, subtitle delay**. Subtitle styling.
  - Stream-limit handling ("reached your stream limit" → option to stop another stream). PiP/cast out of scope v1.

### 6.7 Account / Settings
- Profile + membership tier display, sign-out, and app settings: `uiScale`, reduced motion, default subtitle/audio language, controller layout help, about. Multi-profile switch (read/select) but not creation/PIN in v1.

---

## 7. Video Playback & Widevine

**Path (reusing the base project's hard-won contract):**
1. Resolve stream: call Crunchyroll's play service for the episode → get the DASH/HLS manifest + DRM info. (Base uses a Samsung-TV play endpoint variant; we evaluate the standard device endpoint first, fall back to the TV variant if needed.)
2. Shaka loads the manifest. On license challenge, Shaka calls EME → the **castLabs Widevine CDM** (component-fetched at runtime by the fork; gated behind `app.whenReady` + `components.whenReady()`).
3. License request goes to Crunchyroll's **license proxy** (`…/v1/license/widevine`) with the required headers (`X-Cr-Content-Id`, `X-Cr-Video-Token`) and the castLabs service certificate; the **base64-JSON-wrapped license response is unwrapped client-side** (non-obvious quirk lifted verbatim from the base project). `robustness` set explicitly to `SW_SECURE_CRYPTO` (L3).
4. **VMP signing:** the packaged app is signed with castLabs' EVS tool at build time, or license requests are refused. This is a required CI step, not optional.

**Expectations:** L3 → ~480–720p ceiling, accepted. Hardware decode via VAAPI must be enabled (`--enable-features=VaapiVideoDecoder`, EGL/Wayland ozone) **and verified actually offloaded** inside the Flatpak sandbox, or battery/stutter suffers.

The license/header logic lives in **one `playback` module**, mirroring `service.js`/`player.js` from the base as a *contract*, reimplemented cleanly (no plaintext storage, typed).

---

## 8. Auth & API Integration

- **`auth` module:** device-flow login (§6.1), token refresh (`refresh_token` grant + `refresh_token_profile_id` for profile scoping), expiry tracking, keyring persistence, sign-out. No password is ever stored (base project stored it in plaintext — explicitly rejected).
- **`api` module:** typed client over Crunchyroll's private REST API, reusing the *endpoint contract* documented by the base project's `service.js` (token, profiles, home_feed, seasons, episodes, search, watchlist, history, playheads) — but reimplemented in TS, all calls routed through the **main process** to control User-Agent/headers and avoid CORS. The borrowed client credentials live in one config constant, swappable in seconds if revoked.
- All network failures surface as typed errors → friendly Hime error states, never raw stack traces.

---

## 9. Steam Deck Integration & Packaging

- **Flatpak** is the primary artifact (SteamOS is immutable; pacman installs get wiped on update). Built from source, minimal `finish-args` (GPU `--device=dri`, network, audio, keyring portal). The non-redistributable CDM is fetched at runtime by the fork, not bundled — keeps Flathub-eligibility clean.
- **AppStream metainfo** declares `<control>gamepad</control>` + `<control>console</control>` and a full icon set → Deck "controller-ready" signal; `.desktop` with `Categories=AudioVideo`.
- **Gaming Mode:** add as non-Steam game; ship a **Steam Input controller config template** so bindings are correct out of the box. Launch fullscreen via `-f` (not Gamescope Meta+F, which is buggy).
- **Known pitfalls engineered around:** Steam-Runtime-in-Flatpak focus hang (use a clean native Flatpak), Overlay/Steam-Input not reaching the sandbox (rely on in-app Gamepad API for nav so it works regardless), Electron-version gamepad-detection regressions (pin/verify), Wi-Fi drop on suspend (re-validate session + re-buffer on resume).
- **OSK:** prefer QR login to avoid text entry; where typing is unavoidable (search), support Steam OSK + an in-app on-screen keyboard fallback.

---

## 10. Performance Budget

- **60 fps** during navigation; **30 fps** acceptable for idle/video. Cap framerate; respect Gamescope vsync.
- **Virtualize** every long list/grid (`content-visibility:auto` + windowing). Defer off-screen row queries (IntersectionObserver) as Hayase does.
- **GPU-only animation:** `transform`/`opacity` exclusively; never animate layout properties.
- **Images:** lazy-load, request right-sized thumbnails, decode async, skeletons during load.
- **Video:** hardware decode verified; otherwise treat as a release blocker.
- Memory: Electron baseline is the cost of admission for legal DRM; mitigate with lazy route loading and disposing off-screen media.

---

## 11. Project Structure (proposed)

```
/ (electron app root)
├─ electron/            main + preload (TS): window, CDM, keyring, API proxy, flags
├─ interface/           SvelteKit SPA
│  ├─ src/lib/input/    navigate.ts, gamepad.ts, inputType store  (forked from Hayase)
│  ├─ src/lib/api/      crunchyroll client (typed contract)
│  ├─ src/lib/auth/     device-flow, token/keyring bridge
│  ├─ src/lib/playback/ shaka setup, license/DRM logic
│  ├─ src/lib/ui/       design system: tokens, cards, carousel, banner, player, keyboard
│  └─ src/routes/app/   home, browse, search, anime/[id], player, account, login
├─ flatpak/             manifest, metainfo, desktop, icons, controller template
└─ docs/                this spec + plans
```
Each module has one clear job and a typed interface; the API/contract, the input engine, and the playback/DRM logic are independently testable and independently swappable.

---

## 12. Error Handling & Edge States

Every state gets a designed screen (Hime art + clear copy + a controller-reachable action), never a dead end:
- Offline / connection error; session/token expired (silent refresh, else re-login); **stream limit reached** (offer to stop another stream); **L3 quality cap** (informational, not an error); geo-restricted content; force-update; empty watchlist/history/search; playback failure (manifest/license) with retry.

---

## 13. Open Questions / Decisions Deferred

1. **Brand asset licensing — resolved.** CR logos + Hime are used directly. Precedent is broad (community Tizen / Android-TV ports, many public GitHub projects) and the assets are public; the user has cleared their use. No placeholder art needed.
2. **Standard device play endpoint vs. Samsung-TV endpoint** — confirm which the current API rewards; affects §7 step 1.
3. **castLabs EVS account** for VMP signing — free dev tier exists; confirm terms for our use.
4. **Codename/product name** — "Crunchy Deck" is a placeholder.

---

## 14. Milestones (decomposition — each becomes its own plan)

- **M0 — Spike:** castLabs Electron + Shaka plays one Widevine title at L3 on the Deck, VMP-signed. *Proves the riskiest assumption first.*
- **M1 — Shell + Input:** SvelteKit app, design tokens, icon rail, forked spatial-nav + full gamepad, focus/motion language, one static Home screen. *Proves the "native feel."*
- **M2 — Auth:** device-flow QR login + keyring tokens + refresh.
- **M3 — Data screens:** Home feed, Browse, Search, Series/Episode details wired to the API.
- **M4 — Player:** full player chrome (seek/skip/next/tracks/speed) + resume/playheads.
- **M5 — Deck packaging:** Flatpak, metainfo, controller template, VAAPI verified, suspend/resume.
- **M6 — Polish:** empty/error states, per-series theming, audio/haptic feedback, settings, performance pass.

**M0 is built first** — if the signed-CDM-on-Deck spike fails, the whole approach changes, so we de-risk it before building UI.

---

*End of spec.*
