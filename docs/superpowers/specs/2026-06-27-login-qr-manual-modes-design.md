# Login screen — QR / Manual / Email modes

**Date:** 2026-06-27
**Status:** Approved (design)
**Area:** `src/routes/login/+page.svelte`, `electron/cr/device.ts`

## Problem

The current login screen conflates two distinct sign-in methods onto one screen: it
shows a large QR code **and** the human-readable activation code with "Or visit
crunchyroll.com/activate and enter [CODE]". This muddles the QR auto-sign-in path with
the manual code-entry path.

The official Crunchyroll TV app keeps them as two separate screens:

- **QR screen** — QR only, "Scan the QR Code … to log in automatically". No code.
- **Manual screen** — numbered steps ("Go to crunchyroll.com/activate", "Enter this
  code: XXXXXX", "Stay on this screen"). No QR.

We want the same split, with QR as the primary screen and a toggle to manual, plus the
existing email/password retained as a tertiary fallback.

## Goals

- QR is the primary, default sign-in view and auto-signs-in via a code-embedded URL.
- A user-toggleable Manual (code) view mirroring the CR TV app.
- Email/password kept as a third option, reachable via a link.
- QR and Manual share a single device-flow session — toggling does not restart it or
  change the displayed code.

## Non-goals

- No changes to the device-flow polling protocol, IPC, or preload bridge (already wired).
- DRM/playback identity concerns (the `drm-l3-requires-cr-web-client` question) are out
  of scope here; flagged separately for follow-up.

## Design

### Modes & information architecture

Three view modes in `/login`, default `qr`:

| Mode            | Shows                                      | Navigates to        |
|-----------------|--------------------------------------------|---------------------|
| `qr` (default)  | Large QR + small fallback code             | `manual`, `email`   |
| `manual`        | CR-TV numbered steps + large code, no QR   | `qr`, `email`       |
| `email`         | Existing username/password form            | `qr`                |

### Shared device-flow session

`qr` and `manual` are two views over **one** device-flow session: a single
`window.cr.device.code()` request and a single poll loop. Switching between `qr` and
`manual` only flips the `mode` state — it does **not** re-request a code or restart
polling. The user code stays stable and the phone-scan + poll keep working in either view.

- Device flow starts on mount (mode = `qr`) and polls continuously until success,
  expiry, or unmount.
- `email` is independent (`window.cr.auth.login`) and does not touch the device session.
- This corrects current behavior, where toggling views re-requests a new code each time.

### Backend — `electron/cr/device.ts`

The `DeviceCode` result currently collapses both URIs into one `verification_uri` field
(preferring `verification_uri_complete`). Change it to return **both**:

- `verification_uri_complete` — encoded in the QR (RFC 8628 code-embedded URL → auto
  sign-in).
- `verification_uri` — the bare `…/activate` URL, displayed on the Manual screen.

Keep the existing `console.log('[device] /code response', …)`.

**Build-time verification:** confirm CR actually returns `verification_uri_complete`.
If it is absent, the QR falls back to the bare activation URL (no auto-fill) — that
absence is then the real bug to fix. The Manual screen works regardless.

### Screen layouts

**QR (primary)** — heading "Sign in to Crunchyroll"; "Scan the QR code with your phone
to sign in automatically"; 240px QR on a white card; small fallback line below ("Can't
scan? Code: XXXXXX"); links: "Enter code manually →", "Sign in with email".

**Manual (CR-TV style)** — heading "Sign in to Crunchyroll"; numbered steps:

1. Go to **crunchyroll.com/activate**
2. Enter this code: **X X X X X X** (spaced digit tiles, reuse existing markup)
3. Stay on this screen — you'll be signed in automatically

Plus a "Waiting…" indicator. No QR. Links: "← Show QR code", "Sign in with email".

**Email** — existing form, unchanged, with "← Use QR code instead".

### Shared states & error handling

States `starting / waiting / expired / error` apply to both `qr` and `manual` because
they share the session:

- `expired` → "Generate new code" regenerates for both views.
- `error` → message + retry button.
- Existing `expires_in` (seconds) vs `interval` (milliseconds) quirk is preserved.

### Controller / focus (Steam Deck)

`data-focusable` on every mode-switch link, regenerate/retry button, and email input.
On mode switch, reset focus to the first focusable element in the new view.

## Testing

- **Unit:** `device.ts` mapping returns both `verification_uri` and
  `verification_uri_complete`, with the documented fallback chain when fields are absent.
- **Manual checklist:**
  - QR auto-signs-in when scanned on a phone.
  - Toggling `qr` ↔ `manual` keeps the **same** code and a live poll (no restart).
  - Expiry shows "Generate new code" and regenerating works from either view.
  - Email fallback signs in.
  - All interactive elements are controller-focusable in all three modes.

## Risks / follow-ups

- **DRM identity:** memory note `drm-l3-requires-cr-web-client` claims QR/device-flow
  identity is L1-gated (40131) on L3 devices (Deck/Electron), implying device-flow login
  may authenticate but fail at playback. Commit `6364330` reframes 40131 as a
  VMP/stream-limit gate, so the note may be stale. Out of scope for this UX change;
  verify device-flow login plays on the Deck as a separate task.
