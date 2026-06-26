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
