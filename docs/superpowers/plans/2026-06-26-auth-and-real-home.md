# Auth + Real Home (M2 + M3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Log in against the real Crunchyroll API and render a real Home feed (actual anime, real rows + hero), replacing the mock `/demo` grid.

**Architecture:** All Crunchyroll HTTP lives in the **Electron main process** (Node `fetch`, Tizen-TV User-Agent, tokens in the OS keyring via `safeStorage`) — `webSecurity` stays **on**, no CORS hole. The renderer calls a typed IPC bridge (`window.cr`). Main fetches raw JSON; the renderer holds **pure mappers (TDD)** that turn CR's JSON into view models, plus the auth store + screens.

**Tech Stack:** (unchanged) castLabs Electron · SvelteKit/Svelte 5 · TypeScript · Vitest.

---

## Auth decision (read first)

The base project authenticates with **OAuth password-grant** using the extracted Samsung-TV client credentials. The **QR / device-activation flow is NOT present** in the base source. Therefore:

- **M2 ships password-grant now** (proven, verifiable end-to-end): an email/password login screen (Steam-OSK friendly), tokens in keyring, auto-refresh.
- **QR device-flow is Task 9** — its exact endpoint must be *confirmed*, not guessed (candidate discovery: jadx the APK dex, or community libraries). Flagged; do not fabricate endpoints.

This keeps "real Home" unblocked while we nail the QR UX as a fast-follow.

---

## Contract Appendix (extracted from base `service.js` + `mapper.js` — ground truth)

**Hosts:** api `https://beta-api.crunchyroll.com` · static `https://static.crunchyroll.com` · play `https://cr-play-service.prd.crunchyrollsvc.com`
**Client auth header (Samsung-TV):** `Authorization: Basic eHVuaWh2ZWRidDNtYmlzdWhldnQ6MWtJUzVkeVR2akUwX3JxYUEzWWVBaDBiVVhVbXhXMTE=`
**Token:** `POST /auth/v1/token` form body; grants: `password` (username/password), `refresh_token`, `refresh_token_profile_id` (+`profile_id`); always `scope=offline_access`. Response: `{access_token, refresh_token, expires_in, account_id, country, token_type}`.
**Data (Bearer access_token):**
- Home feed: `GET /content/v2/discover/{account_id}/home_feed?start=0&n=100&preferred_audio_language={audio}&locale={locale}`
- Row items: if panel `resource_type==='dynamic_collection'` → fetch `panel.link`; else `GET /content/v2/cms/objects/{ids.join(',')}?locale={locale}` → `{data:[items]}`
- Search: `GET /content/v2/discover/search?q={q}&type=series,movie_listing&n=100&locale={locale}`
- Profile: `GET /accounts/v1/me/profile` (preferred audio/sub language, avatar, maturity, username)
- Watchlist: `GET /content/v2/discover/{account_id}/watchlist?order=desc&n=1000`
- Playheads: `GET /content/v2/{account_id}/playheads?content_ids={ids}`

**home_feed panels:** banner = panel with `resource_type==='panel'` (`panel.{id,title,description,images.poster_wide[0][4].source}`). Rows = panels whose `response_type` ∈ {`recommendations`,`history`,`browse`,`series`,`because_you_watched`}, each `{title, resource_type, ids[]|link}`.

**mapItems rules** (item may be wrapped in `.panel`; `item.type`):
- `episode` → id=`episode_metadata.series_id`, title=`episode_metadata.series_title`, bg=`images.thumbnail[0][4].source`, display=`episode`, duration=`episode_metadata.duration_ms/60000`
- `movie` → bg=`images.thumbnail[0][4].source`, display=`episode`
- else (series) → bg=`images.poster_wide[0][4].source`, poster=`images.poster_tall[0][2].source`, display=`serie`
- `playhead` (seconds) → minutes via `/60`. Images are arrays-of-arrays; index defensively (try/catch → placeholder).

---

## Tasks

### Task 1: View-model types + `mapItems` pure mapper (TDD)
- Create `src/lib/api/types.ts` (`CrItem`, `CrRow`, `CrBanner`, `CrHome`).
- Create `src/lib/api/map.ts` + `src/lib/api/map.test.ts`.
- Test fixtures for a **series** item (`type:'series'`, `images.poster_wide`/`poster_tall`) and an **episode** item (`type:'episode'`, `episode_metadata`, `images.thumbnail`), asserting correct id/title/background/display/duration. Defensive image access returns a placeholder URL on missing nesting (assert no throw).

### Task 2: `mapHome` pure mapper (TDD)
- Add `mapBanner(panel)` + `mapRows(panels, itemsByRow)` to `map.ts`; tests with a fixture `home_feed` (one `resource_type:'panel'` banner + two rows with `response_type` in the allow-list) + a map of row-id → items. Assert banner fields and that only allow-listed/non-empty rows survive.

### Task 3: Main — CR HTTP client
- `electron/cr/client.ts`: `crFetch(path, {method, form, json, bearer})` using Node `fetch`, base = api host, sets Tizen UA + `Authorization` (Basic for token, `Bearer {token}` for data). Returns parsed JSON; throws typed `CrError` on non-2xx.

### Task 4: Main — auth (password grant + keyring + refresh) + IPC
- `electron/cr/auth.ts`: `login(user,pass)`, `refreshIfNeeded()`, `accessToken()`, `logout()`, `status()`. Persist `{refresh_token, account_id, ...}` via `safeStorage.encryptString` to a `userData/session.bin` file; compute expiry from `expires_in`. Never store the password.
- `electron/ipc.ts`: handlers `auth:login`, `auth:logout`, `auth:status`.

### Task 5: Main — home loader (orchestrates the two-step fetch)
- `electron/cr/home.ts`: `loadHome(locale, audio)` → fetch home_feed, then for each row fetch its items (`cms/objects/{ids}` or `link`), return `{ banner, rows:[{title, rawItems}] }` (raw JSON — renderer maps). IPC `api:home`.

### Task 6: Preload typed bridge
- `electron/preload.ts`: expose `window.cr.auth.{login,logout,status}` + `window.cr.api.{home}` via `ipcRenderer.invoke`. Update `src/app.d.ts` Window type.

### Task 7: Renderer — auth store + login screen
- `src/lib/auth/store.ts` (`authState`), `src/routes/login/+page.svelte` (email/pass, focusable, Steam-OSK friendly, error states with Hime art later). On success → goto `/home`.

### Task 8: Renderer — real Home screen
- `src/routes/home/+page.svelte`: on mount call `cr.api.home`, map via `map.ts`, render hero banner + rows of `Card` (reuse the demo's focus/motion). Loading skeletons, empty/error states. Make `/` redirect to `/home` (or `/login` if not authed).

### Task 9: QR device-flow login (FLAGGED — endpoint to confirm)
- Discover CR's device-code endpoint (jadx the APK dex under `_research/apk`, or community libs). Implement RFC-8628-style: request code → show QR of `verification_uri_complete` + `user_code` → poll token endpoint. Replace/augment Task 7 login. **Blocked on endpoint confirmation; do not ship guessed URLs.**

---

## Verification
- Tasks 1–2: `pnpm test` green (pure mappers).
- Tasks 3–8: type-check + build; **live login + real Home require the user's Crunchyroll credentials** → manual gate on-device (same pattern as the M0/M1 GUI gates).
- Task 9: gated on endpoint confirmation.

## Self-Review
- Coverage: auth (T3–4,7), real home incl. two-step fetch + mapping (T1–2,5,8), IPC (T6). QR explicitly deferred with reason (T9).
- No fabricated endpoints: every URL above is copied from the base source; the one unknown (device-code) is flagged, not invented.
- Security: tokens in keyring (main only), `webSecurity` on, no plaintext password — fixes the base's sins.
