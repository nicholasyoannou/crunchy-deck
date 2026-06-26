import { app, BrowserWindow, components } from 'electron'
import path from 'node:path'
import { registerIpc } from './ipc.js'

const isDev = !!process.env.ELECTRON_RENDERER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  if (isDev) win.loadURL(process.env.ELECTRON_RENDERER_URL!)
  else win.loadFile(path.join(__dirname, '../build/index.html'))
}

app.whenReady().then(() => {
  registerIpc()
  createWindow() // show the UI immediately so the boot animation can play
  // Widevine CDM loads in the background; only playback needs it, so it must not
  // block first paint (this is what lets the logo animation mask boot time).
  components
    .whenReady()
    .then(() => console.log('[cdm] components ready:', components.status()))
    .catch((e) => console.error('[cdm] init error:', e))
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
