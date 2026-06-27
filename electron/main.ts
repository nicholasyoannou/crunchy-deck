import { app, BrowserWindow, components, session } from 'electron'
import path from 'node:path'
import http from 'node:http'
import { readFileSync, existsSync, appendFileSync } from 'node:fs'
import { registerIpc } from './ipc.js'
import { initUpdater } from './updater.js'
import { CR } from './cr/client.js'

const isDev = !!process.env.ELECTRON_RENDERER_URL

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
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as any).port)))
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
    win.webContents.setVisualZoomLevelLimits(1, 1)
    win.webContents.setZoomFactor(UI_SCALE)
  })
  win.loadURL(loadUrl)
  return win
}

app.whenReady().then(async () => {
  installFileLogger()
  installMediaHeaderRules()
  registerIpc()
  const url = isDev
    ? process.env.ELECTRON_RENDERER_URL!
    : `http://127.0.0.1:${await serveStatic(path.join(__dirname, '../build'))}/`
  let win = createWindow(url)
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
