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
- 2026-06-26 / Windows 11 / unsigned dev run: **CDM bootstraps successfully.**
  `components.whenReady()` reports both modules `status: 'updated'`:
  Google Widevine Windows CDM 1.0.2738.0 + Widevine Content Decryption Module 4.10.3050.0.
- Test-stream visual playback (Angel One + CWIP proxy): PENDING human eyes on GUI.
- On-Deck (Linux, VMP-signed) validation: PENDING (later milestone).
- Errors: none at CDM init.
