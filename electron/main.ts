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

// Gaming-Mode launch fix: Chromium's seccomp-bpf sandbox conflicts with gamescope/Steam's kernel
// sandboxing → the renderer hangs for minutes under gamescope. --no-sandbox resolves it. BUT on the
// KDE Wayland Desktop the sandbox is fine and --no-sandbox instead BREAKS the renderer (the window
// opens but the page never finishes loading → blank screen). So gate it to gamescope only; the Desktop
// keeps its sandbox. (User-confirmed: Desktop worked before this Gaming-Mode tuning landed.)
if (onGamescope) app.commandLine.appendSwitch('no-sandbox')

// GPU: under gamescope the GL path is a trap (gl=none + crash-retry → blank / multi-minute launch), so
// force software there. On the Desktop the hardware GPU works (it did before this tuning), so leave it.
// CR_GL=<gl|gles|vulkan> opts into a hardware-accel attempt anywhere; CR_NO_GPU forces software. Must
// run before app ready (module load).
function tuneGpuForGamescope() {
  const env = process.env
  if (env.CR_GL) {
    app.commandLine.appendSwitch('use-gl', 'angle')
    app.commandLine.appendSwitch('use-angle', env.CR_GL) // experiment with a real backend (e.g. vulkan)
    app.commandLine.appendSwitch('disable-gpu-sandbox')
  } else if (env.CR_NO_GPU || onGamescope) {
    app.disableHardwareAcceleration() // software under gamescope; Desktop uses the hardware GPU
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

// We serve the app over http://127.0.0.1, so Chromium attaches a Referer to CDN media requests. CR's
// Akamai CDN hotlink-protects segments and denies any non-crunchyroll Referer ("403 Access Denied 2").
// The base project loads via file:// (which sends no Referer) and plays fine — so strip the Referer
// (and Origin) on CDN media requests to match. Page JS can't touch these forbidden headers; this can.
function installMediaHeaderRules() {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        '*://*.crunchyrollcdn.com/*',
        '*://*.vrv.co/*',
        '*://*.akamaized.net/*',
        '*://*.crunchyrollsvc.com/*',
        '*://*.crunchyroll.com/*'
      ]
    },
    (details, cb) => {
      const h = details.requestHeaders
      // Chromium Client Hints reveal the real platform (e.g. "Windows"), which contradicts our
      // Tizen-TV User-Agent; CR's license server flags that mismatch and rejects with 4035. Strip
      // them so we look like a consistent TV client. (The base repo runs on Linux, so its hint
      // matches a TV and it never hits this.)
      for (const k of ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'Sec-Ch-Ua', 'Sec-Ch-Ua-Mobile', 'Sec-Ch-Ua-Platform']) delete h[k]
      // CDN segments + the license host are also Referer/Origin hotlink-checked; the base sends none
      // (it loads via file://), so strip those for those hosts too.
      if (/crunchyrollcdn\.com|vrv\.co|akamaized\.net|crunchyrollsvc\.com/.test(details.url)) {
        delete h['Referer']
        delete h['referer']
        delete h['Origin']
        delete h['origin']
      }
      cb({ requestHeaders: h })
    }
  )
  // Diagnostic: log the EXACT headers the renderer sends to the license server, to compare against
  // the base repo (which sends from a file:// origin, i.e. no Origin/Referer).
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
    fullscreen: true, // a TV/console-style app — launch filling the screen, not in a window

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
      angle: app.commandLine.getSwitchValue('use-angle') || '(default)'
    })
  )
  console.log('[gpu-features]', JSON.stringify(app.getGPUFeatureStatus()))
  app
    .getGPUInfo('basic')
    .then((i) => console.log('[gpu]', JSON.stringify(i)))
    .catch((err) => console.log('[gpu] info error', String(err)))
  installMediaHeaderRules()
  registerIpc()
  const url = isDev
    ? process.env.ELECTRON_RENDERER_URL!
    : `http://127.0.0.1:${await serveStatic(path.join(__dirname, '../build'))}/`
  boot('served')
  let win = createWindow(url)
  boot('window-created')
  initUpdater(win) // self-update from GitHub Releases (packaged AppImage only)
  // Widevine CDM loads in the background; only playback needs it, so it must not
  // block first paint (this is what lets the logo animation mask boot time).
  components
    .whenReady()
    .then(() => console.log('[cdm] components ready:', components.status()))
    .catch((e) => console.error('[cdm] init error:', e))
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) win = createWindow(url)
  })
})

// Every quit path funnels through killTreeAndExit (fast, complete teardown). Crucially that includes
// SIGTERM — how Steam's "Exit game" / closing from the overlay stops us; without this handler Electron
// runs its slow graceful shutdown and quitting takes many seconds under gamescope.
ipcMain.on('app:quit', () => killTreeAndExit('ipc'))
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') killTreeAndExit('window-all-closed')
})
process.on('SIGTERM', () => killTreeAndExit('sigterm'))
process.on('SIGINT', () => killTreeAndExit('sigint'))
