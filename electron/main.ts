import { app, BrowserWindow, components, session, ipcMain } from 'electron'
import path from 'node:path'
import http from 'node:http'
import dns from 'node:dns'
import { readFileSync, existsSync, appendFileSync } from 'node:fs'

// Prefer IPv4: the Steam runtime / gamescope network namespace often has broken IPv6, so Node's default
// "try IPv6 first" makes every auth/profiles/home request stall on a timeout -> minute-long launches.
dns.setDefaultResultOrder('ipv4first')
import { registerIpc } from './ipc.js'
import { initUpdater } from './updater.js'
import { killTreeAndExit } from './lifecycle.js'
import { CR } from './cr/client.js'
import { rewriteRendererRequestHeaders } from './cr/requestHeaders.js'

const isDev = !!process.env.ELECTRON_RENDERER_URL

// Boot timing — surfaces where launch time goes (Steam reports ~1min sometimes). T0 ≈ main start.
const T0 = Date.now()
const boot = (stage: string) => console.log(`[boot] ${stage} +${Date.now() - T0}ms`)

// Gaming Mode runs under gamescope; Desktop Mode is plain KDE Wayland. Detect it once — the two fixes
// below are needed ONLY under gamescope and actively BREAK the Desktop launch (blank window).
const onGamescope = !!(
  process.env.GAMESCOPE_WAYLAND_DISPLAY ||
  /gamescope/i.test(process.env.XDG_CURRENT_DESKTOP ?? '') ||
  /gamescope/i.test(process.env.XDG_SESSION_DESKTOP ?? '')
)

// Capture Chromium/GPU-process failures too. These can occur before the JS logger is installed and are
// otherwise invisible when Steam starts the packaged app without a terminal.
app.commandLine.appendSwitch('enable-logging', 'file')

// Steam Gaming Mode is an XWayland client inside gamescope. Electron 38+ may auto-select native Wayland,
// which is a materially different compositor path from Desktop Mode and can produce a black window or
// renderer exit. Keep Gaming Mode on the mature XWayland path and retain the gamescope-only sandbox
// workaround; Desktop Mode keeps Electron's automatic platform selection and normal sandbox.
if (onGamescope) {
  app.commandLine.appendSwitch('no-sandbox')
  app.commandLine.appendSwitch('ozone-platform', 'x11')
}

// Keep the normal accelerated compositor under gamescope. Disabling it changes video/compositing behavior
// and has caused black windows on Deck-class systems. CR_NO_GPU remains an explicit recovery switch, while
// CR_GL=<gl|gles|vulkan> lets diagnostics select a specific ANGLE backend. Must run before app ready.
function tuneGpuForGamescope() {
  const env = process.env
  if (env.CR_GL) {
    app.commandLine.appendSwitch('use-gl', 'angle')
    app.commandLine.appendSwitch('use-angle', env.CR_GL) // experiment with a real backend (e.g. vulkan)
    app.commandLine.appendSwitch('disable-gpu-sandbox')
  } else if (env.CR_NO_GPU) {
    app.disableHardwareAcceleration()
  }
}
tuneGpuForGamescope()

// The UI is laid out at a desktop 16px-root baseline, but the Steam Deck panel is 1280x800 on a
// dense 7" screen — at DPR 1 every CSS px is one tiny physical px, so the whole UI reads as
// minuscule held-in-hand. Apply a page zoom so text/cards/video all scale up crisply (zoom also
// multiplies devicePixelRatio, so images stay sharp). Tunable via CR_UI_SCALE for other displays.
const UI_SCALE = (() => {
  const n = Number(process.env.CR_UI_SCALE)
  return Number.isFinite(n) && n > 0 ? n : 1.5
})()

// Mirror console output to a file so the packaged (windowed, no-stdout) app is debuggable.
function installFileLogger() {
  try {
    const logPath = path.join(app.getPath('userData'), 'app.log')
    const orig = console.log.bind(console)
    const write = (...a: any[]) => {
      orig(...a)
      try {
        appendFileSync(logPath, a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') + '\n')
      } catch {
        /* ignore */
      }
    }
    console.log = write
    console.error = write
  } catch {
    /* ignore */
  }
}

// Serve the built SvelteKit SPA over localhost. We can't use file:// because the adapter-static
// fallback emits absolute (/_app/...) asset URLs; an HTTP origin also gives the SPA client router
// a real base + lets unknown routes fall back to index.html.
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json'
}

// Fixed loopback port for the bundled SPA so the origin (and its localStorage) is stable across launches.
const STABLE_PORT = 43547
// The static server, kept module-level so quit can close its listening socket before process.exit —
// an open loopback socket/FD can keep Steam's reaper thinking the process is still alive (Big Picture
// "abort game" loop).
let staticServer: import('node:http').Server | null = null

function serveStatic(dir: string): Promise<number> {
  const server = http.createServer((req, res) => {
    let pathname = '/'
    try {
      pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
    } catch {
      /* default */
    }
    let file = path.join(dir, pathname)
    if (!existsSync(file) || pathname === '/') file = path.join(dir, 'index.html')
    if (!existsSync(file)) file = path.join(dir, 'index.html') // SPA fallback for client routes
    try {
      const data = readFileSync(file)
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  staticServer = server // closed on quit (see doQuit) so the loopback socket is released before exit
  // Listen on a STABLE port so the page origin (http://127.0.0.1:PORT) is the same every launch.
  // localStorage / IndexedDB are scoped to the exact origin, so a random port (listen 0) silently wiped
  // every persisted setting (e.g. the skip interval) on each restart. Fall back to a random port only if
  // the fixed one is taken — rare, since the quit teardown frees it (settings just won't persist that run).
  return new Promise((resolve) => {
    const onUp = () => resolve((server.address() as { port: number }).port)
    server.once('error', (e: NodeJS.ErrnoException) => {
      console.log('[serve] fixed port unavailable:', e.code, '— using a random port (settings may reset this run)')
      server.listen(0, '127.0.0.1', onUp)
    })
    server.listen(STABLE_PORT, '127.0.0.1', onUp)
  })
}

// Shaka runs in the renderer, but Crunchyroll uses different header profiles for TV API/license
// requests and signed media URLs. Page JS cannot reliably set Origin, Referer, User-Agent, or
// Accept-Encoding, so enforce the profiles in the main process immediately before each request.
function installMediaHeaderRules() {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        '*://*.crunchyrollcdn.com/*',
        '*://*.gccrunchyroll.com/*', // CR's Google-Edge-Cache CDN — some content routes here, not Akamai
        '*://*.vrv.co/*',
        '*://*.akamaized.net/*',
        '*://*.crunchyrollsvc.com/*',
        '*://*.crunchyroll.com/*'
      ]
    },
    (details, cb) => {
      cb({ requestHeaders: rewriteRendererRequestHeaders(details.url, details.requestHeaders) })
    }
  )
  // Diagnostic: log the final license profile without logging complete credentials.
  session.defaultSession.webRequest.onSendHeaders({ urls: ['*://*.crunchyrollsvc.com/*'] }, (details) => {
    if (!details.url.includes('license')) return
    const hs = Object.entries(details.requestHeaders)
      .map(([k, v]) => `${k}=${String(v).slice(0, 28)}`)
      .join(' | ')
    console.log('[lic-req]', details.method, hs)
  })
}

function createWindow(loadUrl: string) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Crunchy Deck',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    // gamescope already presents the Steam app fullscreen. Asking Electron to transition the X11 window
    // into native fullscreen as it is being embedded can crash/restart gamescope on some Deck setups.
    fullscreen: !onGamescope,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Shaka fetches CR's DASH manifest/segments + the Widevine license cross-origin from the
      // renderer (all Bearer-authed); CR's media servers don't answer CORS preflights, so disable
      // web security. Safe here: we only ever load our own bundled SvelteKit app, never remote content.
      webSecurity: false
    }
  })
  win.webContents.setUserAgent(CR.UA) // Tizen-TV UA to match the cr_smart_tv client
  win.on('page-title-updated', (e) => e.preventDefault()) // keep the OS window titled "Crunchy Deck"
  // Scale the UI up for the Deck panel. Pin the zoom on every load so SPA reloads / HMR can't
  // reset it, and clamp pinch-zoom so the layout can't drift off this baseline.
  win.webContents.on('did-finish-load', () => {
    boot('did-finish-load')
    win.webContents.setVisualZoomLevelLimits(1, 1)
    win.webContents.setZoomFactor(UI_SCALE)
  })
  // Blank-screen diagnostics: pinpoint WHERE the load dies (start -> dom-ready -> finish), surface a
  // renderer crash / failed load / its console errors. All land in app.log.
  win.webContents.on('did-start-loading', () => boot('did-start-loading'))
  win.webContents.on('dom-ready', () => boot('dom-ready'))
  win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) =>
    console.log('[did-fail-load]', code, desc, url, 'main=' + isMainFrame)
  )
  win.webContents.on('render-process-gone', (_e, d) => console.log('[render-gone]', JSON.stringify(d)))
  win.webContents.on('unresponsive', () => console.log('[unresponsive]'))
  win.webContents.on('console-message', (_e, level, message, line, sourceId) =>
    console.log('[rconsole]', level, (sourceId || '') + ':' + line, String(message).slice(0, 280))
  )
  win.loadURL(loadUrl).catch((err) => console.log('[loadURL] rejected', String(err)))
  return win
}

app.whenReady().then(async () => {
  installFileLogger()
  boot('app-ready')
  app.on('child-process-gone', (_e, d) => console.log('[child-gone]', JSON.stringify(d)))
  // Diagnostics: session/compositor + GPU backend, so a blank Gaming-Mode window is debuggable from app.log.
  const e = process.env
  console.log(
    '[env]',
    JSON.stringify({
      sessionType: e.XDG_SESSION_TYPE,
      desktop: e.XDG_CURRENT_DESKTOP,
      sessionDesktop: e.XDG_SESSION_DESKTOP,
      gamescope: e.GAMESCOPE_WAYLAND_DISPLAY,
      wayland: e.WAYLAND_DISPLAY,
      display: e.DISPLAY,
      steam: !!(e.SteamEnv || e.SteamGameId || e.SteamAppId),
      ozone: app.commandLine.getSwitchValue('ozone-platform') || '(auto)',
      angle: app.commandLine.getSwitchValue('use-angle') || '(default)',
      hardwareAcceleration: app.isHardwareAccelerationEnabled()
    })
  )
  app
    .getGPUInfo('basic')
    .then((i) => {
      console.log('[gpu]', JSON.stringify(i))
      console.log('[gpu-features]', JSON.stringify(app.getGPUFeatureStatus()))
    })
    .catch((err) => console.log('[gpu] info error', String(err)))
  // CastLabs recommends waiting for Electron's component updater before creating a playback window.
  // Continue after a rejected update (for example, offline) so a CDM update failure never hides the UI.
  try {
    await components.whenReady()
    console.log('[cdm] components ready:', components.status())
  } catch (err) {
    console.error('[cdm] init error:', err)
  }
  boot('components-ready')
  installMediaHeaderRules()
  registerIpc()
  const url = isDev
    ? process.env.ELECTRON_RENDERER_URL!
    : `http://127.0.0.1:${await serveStatic(path.join(__dirname, '../build'))}/`
  boot('served')
  let win = createWindow(url)
  boot('window-created')
  initUpdater(win) // self-update from GitHub Releases (packaged AppImage only)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) win = createWindow(url)
  })
}).catch((err) => {
  console.error('[boot-fatal]', err)
  app.exit(1)
})

// Every quit path funnels through doQuit. Crucially that includes SIGTERM — how Steam's "Exit game" /
// overlay-close stops us; without this handler Electron runs its slow graceful shutdown (multi-second
// under gamescope). Before the hard kill we CLOSE the static server: an open loopback listening socket
// can keep Steam's reaper treating the process as still alive (Big Picture "abort game" loop), so we
// release it first. removeAllListeners stops any stray IPC from re-triggering mid-teardown.
function doQuit(reason: string) {
  try {
    staticServer?.close()
  } catch {
    /* ignore */
  }
  try {
    ipcMain.removeAllListeners()
  } catch {
    /* ignore */
  }
  killTreeAndExit(reason)
}
ipcMain.on('app:quit', () => doQuit('ipc'))
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') doQuit('window-all-closed')
})
process.on('SIGTERM', () => doQuit('sigterm'))
process.on('SIGINT', () => doQuit('sigint'))
