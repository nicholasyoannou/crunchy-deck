import { ipcMain } from 'electron'
import { login, logout, status } from './cr/auth.js'
import { loadHome } from './cr/home.js'
import { requestDeviceCode, pollDeviceToken } from './cr/device.js'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) }
  }
}

export function registerIpc() {
  ipcMain.handle('auth:login', (_e, { username, password }) => wrap(() => login(username, password)))
  ipcMain.handle('auth:logout', () => wrap(async () => logout()))
  ipcMain.handle('auth:status', () => wrap(() => status()))
  ipcMain.handle('api:home', (_e, { locale }: { locale?: string }) => wrap(() => loadHome(locale)))
  ipcMain.handle('device:code', () => wrap(() => requestDeviceCode()))
  ipcMain.handle('device:poll', (_e, { device_code }: { device_code: string }) => wrap(() => pollDeviceToken(device_code)))
}
