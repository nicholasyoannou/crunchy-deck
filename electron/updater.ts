import { BrowserWindow, ipcMain, app } from 'electron'
// electron-updater is CommonJS with `__esModule: true` but NO default export, so a default
// import resolves to undefined under esModuleInterop. Use a named import.
import { autoUpdater } from 'electron-updater'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Self-update for the packaged AppImage (Steam Deck). Stable = full GitHub releases; Dev = prereleases.
// We persist the channel + last-checked + last-updated so Settings can show + control all of it.
type Channel = 'stable' | 'dev'
interface UState {
  channel: Channel
  lastChecked: number | null
  lastUpdated: { version: string; at: number } | null
  knownVersion: string // the version we last ran as — used to detect a completed self-update
}
const DEFAULTS: UState = { channel: 'stable', lastChecked: null, lastUpdated: null, knownVersion: '' }

let state: UState = { ...DEFAULTS }
let win: BrowserWindow | null = null

const stateFile = () => path.join(app.getPath('userData'), 'update-state.json')
function load(): UState {
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(stateFile(), 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}
function save() {
  try {
    writeFileSync(stateFile(), JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function snapshot() {
  return { ...state, currentVersion: app.getVersion(), packaged: app.isPackaged }
}
function pushState() {
  if (win && !win.isDestroyed()) win.webContents.send('update:state', snapshot())
}
function applyChannel() {
  // electron-updater's GitHub provider matches a prerelease in the releases feed ONLY when its channel
  // (from the -dev.N tag) equals autoUpdater.channel — so the dev channel MUST be 'dev', not 'latest'
  // (else: "No published versions on GitHub"). It then looks for dev-linux.yml and, on 404, falls back
  // to latest-linux.yml — which is what our dev prereleases actually ship.
  const dev = state.channel === 'dev'
  autoUpdater.channel = dev ? 'dev' : 'latest'
  autoUpdater.allowPrerelease = dev
}

async function doCheck() {
  state.lastChecked = Date.now()
  save()
  pushState()
  if (!app.isPackaged) return { available: false } // dev run: nothing to update
  try {
    const r = await autoUpdater.checkForUpdates()
    const v = r?.updateInfo?.version
    return { available: !!v && v !== app.getVersion(), version: v }
  } catch (e) {
    console.error('[update] check', String((e as any)?.message ?? e).slice(0, 140))
    return { available: false, error: 'check failed' }
  }
}

export function initUpdater(window: BrowserWindow) {
  win = window
  state = load()

  // Detect a just-completed self-update: running version differs from the last recorded one.
  const cur = app.getVersion()
  if (app.isPackaged && state.knownVersion && state.knownVersion !== cur) {
    state.lastUpdated = { version: cur, at: Date.now() }
  }
  state.knownVersion = cur
  save()

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  applyChannel()

  const send = (ch: string, d?: unknown) => {
    if (win && !win.isDestroyed()) win.webContents.send(ch, d)
  }
  autoUpdater.on('update-available', (info) => send('update:available', { version: info.version }))
  autoUpdater.on('update-not-available', () => send('update:none'))
  autoUpdater.on('download-progress', (p) => send('update:progress', { percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => send('update:downloaded', { version: info.version }))
  autoUpdater.on('error', (e) => console.error('[update] error', String((e as any)?.message ?? e).slice(0, 200)))

  ipcMain.handle('update:download', () => autoUpdater.downloadUpdate())
  ipcMain.handle('update:install', () => {
    // Drop window-all-closed (which would app.quit() before the updater can relaunch), then force the
    // freshly-installed AppImage to start after quitting (isForceRunAfter=true).
    app.removeAllListeners('window-all-closed')
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
  })
  ipcMain.handle('update:check', () => doCheck())
  ipcMain.handle('update:getState', () => snapshot())
  ipcMain.handle('update:setChannel', (_e, channel: Channel) => {
    state.channel = channel === 'dev' ? 'dev' : 'stable'
    save()
    applyChannel()
    return doCheck()
  })

  if (app.isPackaged) {
    setTimeout(doCheck, 5000)
    setInterval(doCheck, 6 * 60 * 60 * 1000)
  }
}
