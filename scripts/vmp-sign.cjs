const { execFileSync } = require('node:child_process')

// electron-builder afterPack hook: production VMP-sign the packaged app with castLabs EVS so the
// Widevine CDM is accepted by PRODUCTION license servers (Crunchyroll). castLabs' prebuilt Electron
// is only DEV-signed, which production servers reject (HTTP 400 on the license challenge).
//
// One-time setup (per machine):
//   python -m pip install castlabs-evs
//   python -m castlabs_evs.account signup     # free; creates the EVS account used to sign
//
// Set EVS_SKIP=1 to package without signing (the unsigned build will NOT get production licenses).
module.exports = async function vmpSign(context) {
  if (process.env.EVS_SKIP === '1') {
    console.log('[vmp] EVS_SKIP=1 — skipping VMP signing (no production Widevine licenses)')
    return
  }
  // Linux doesn't need VMP signing — the base project (crunchyroll-linux) ships unsigned and the
  // tv/samsung license works on the Steam Deck. EVS sign-pkg also can't process Linux ELF binaries
  // from a Windows host. So only VMP-sign Windows/macOS packages.
  if (context.electronPlatformName === 'linux') {
    console.log('[vmp] linux target — skipping VMP signing (not required for L3 on Linux)')
    return
  }
  const dir = context.appOutDir
  const py = process.env.PYTHON || 'python'
  // Strip any HTTP(S) proxy (e.g. a Charles MITM) so the EVS API TLS isn't intercepted.
  const env = { ...process.env }
  for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete env[k]
  console.log('[vmp] sign-pkg', dir)
  execFileSync(py, ['-m', 'castlabs_evs.vmp', 'sign-pkg', dir], { stdio: 'inherit', env })
  console.log('[vmp] signed OK')
}
