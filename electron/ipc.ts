import { ipcMain } from 'electron'
import { login, logout, status } from './cr/auth.js'
import { loadHome, loadRow, type RowDescriptor } from './cr/home.js'
import { loadSeries, loadEpisodes } from './cr/series.js'
import { resolveStream, releaseStream } from './cr/stream.js'
import { requestDeviceCode, pollDeviceToken } from './cr/device.js'

type Result<T> = { ok: true; data: T } | { ok: false; error: string; authExpired?: boolean }

async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e: any) {
    const msg = String(e?.message ?? e)
    const authExpired = e?.status === 401 || /not_authenticated|invalid_grant|unauthorized/i.test(msg)
    return { ok: false, error: msg, authExpired }
  }
}

export function registerIpc() {
  ipcMain.on('cr:log', (_e, m) => console.log('[renderer]', String(m).slice(0, 600)))
  ipcMain.handle('auth:login', (_e, { username, password }) => wrap(() => login(username, password)))
  ipcMain.handle('auth:logout', () => wrap(async () => logout()))
  ipcMain.handle('auth:status', () => wrap(() => status()))
  ipcMain.handle('api:home', (_e, { locale }: { locale?: string }) => wrap(() => loadHome(locale)))
  ipcMain.handle('api:row', (_e, { desc, locale }: { desc: RowDescriptor; locale?: string }) => wrap(() => loadRow(desc, locale)))
  ipcMain.handle('api:series', (_e, { id, locale }: { id: string; locale?: string }) => wrap(() => loadSeries(id, locale)))
  ipcMain.handle('api:episodes', (_e, { seasonId, locale }: { seasonId: string; locale?: string }) => wrap(() => loadEpisodes(seasonId, locale)))
  ipcMain.handle('api:stream', (_e, { id }: { id: string }) => wrap(() => resolveStream(id)))
  ipcMain.handle('api:streamRelease', (_e, { contentId, videoToken }: { contentId: string; videoToken: string }) => wrap(() => releaseStream(contentId, videoToken)))
  ipcMain.handle('device:code', () => wrap(() => requestDeviceCode()))
  ipcMain.handle('device:poll', (_e, { device_code }: { device_code: string }) => wrap(() => pollDeviceToken(device_code)))
}
