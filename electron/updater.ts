import { BrowserWindow, ipcMain, app } from 'electron'
// electron-updater is CommonJS with `__esModule: true` but NO default export, so a default
// import resolves to undefined under esModuleInterop. Use a named import (compiles to
// require('electron-updater').autoUpdater) so the main process doesn't crash at load.
import { autoUpdater } from 'electron-updater'

// Self-update for the packaged AppImage (Steam Deck). We do NOT auto-download: the renderer shows a
// banner, the user opts in, then we download (with progress) and quitAndInstall() to swap the
// AppImage in place and relaunch — the standard, Deck-compatible AppImage update flow.
export function initUpdater(win: BrowserWindow) {
  if (!app.isPackaged) return // dev build: nothing to update

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  const send = (channel: string, data?: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, data)
  }

  autoUpdater.on('update-available', (info) => {
    console.log('[update] available', info.version)
    send('update:available', { version: info.version })
  })
  autoUpdater.on('update-not-available', () => console.log('[update] up to date'))
  autoUpdater.on('download-progress', (p) => send('update:progress', { percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[update] downloaded', info.version)
    send('update:downloaded', { version: info.version })
  })
  autoUpdater.on('error', (e) => console.error('[update] error', String((e as any)?.message ?? e).slice(0, 200)))

  ipcMain.handle('update:download', () => autoUpdater.downloadUpdate())
  ipcMain.handle('update:install', () => autoUpdater.quitAndInstall())

  // Check shortly after launch (let the UI settle first), then every 6 hours.
  const check = () => autoUpdater.checkForUpdates().catch((e) => console.error('[update] check', String((e as any)?.message ?? e).slice(0, 140)))
  setTimeout(check, 5000)
  setInterval(check, 6 * 60 * 60 * 1000)
}
