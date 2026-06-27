import { ipcMain } from 'electron'
import { login, logout, status, getProfiles, switchProfile } from './cr/auth.js'
import { loadHome, loadRow, type RowDescriptor } from './cr/home.js'
import { loadSeries, loadEpisodes, loadHeroDetail } from './cr/series.js'
import { loadSearch } from './cr/search.js'
import { loadWatchlist, checkWatchlist, addWatchlist, removeWatchlist } from './cr/watchlist.js'
import { loadBrowse, type BrowseOpts } from './cr/browse.js'
import { loadCategories } from './cr/categories.js'
import { loadSeasons } from './cr/seasons.js'
import { loadHistory } from './cr/history.js'
import { resolveStream, releaseStream, setPlayhead } from './cr/stream.js'
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
  ipcMain.on('cr:log', (_e, m) => console.log('[renderer]', String(m).slice(0, 1800)))
  ipcMain.handle('auth:login', (_e, { username, password }) => wrap(() => login(username, password)))
  ipcMain.handle('auth:logout', () => wrap(async () => logout()))
  ipcMain.handle('auth:status', () => wrap(() => status()))
  ipcMain.handle('auth:profiles', () => wrap(() => getProfiles()))
  ipcMain.handle('auth:switchProfile', (_e, { profile_id }: { profile_id: string }) => wrap(() => switchProfile(profile_id)))
  ipcMain.handle('api:home', (_e, { locale }: { locale?: string }) => wrap(() => loadHome(locale)))
  ipcMain.handle('api:row', (_e, { desc, locale }: { desc: RowDescriptor; locale?: string }) => wrap(() => loadRow(desc, locale)))
  ipcMain.handle('api:series', (_e, { id, locale }: { id: string; locale?: string }) => wrap(() => loadSeries(id, locale)))
  ipcMain.handle('api:heroDetail', (_e, { id, locale }: { id: string; locale?: string }) => wrap(() => loadHeroDetail(id, locale)))
  ipcMain.handle('api:episodes', (_e, { seasonId, locale }: { seasonId: string; locale?: string }) => wrap(() => loadEpisodes(seasonId, locale)))
  ipcMain.handle('api:search', (_e, { query, locale }: { query: string; locale?: string }) => wrap(() => loadSearch(query, locale)))
  ipcMain.handle('api:watchlist', (_e, { locale }: { locale?: string }) => wrap(() => loadWatchlist(locale)))
  ipcMain.handle('api:watchlistCheck', (_e, { contentId, locale }: { contentId: string; locale?: string }) => wrap(() => checkWatchlist(contentId, locale)))
  ipcMain.handle('api:watchlistAdd', (_e, { contentId, locale }: { contentId: string; locale?: string }) => wrap(() => addWatchlist(contentId, locale)))
  ipcMain.handle('api:watchlistRemove', (_e, { contentId, locale }: { contentId: string; locale?: string }) => wrap(() => removeWatchlist(contentId, locale)))
  ipcMain.handle('api:browse', (_e, { opts, locale }: { opts?: BrowseOpts; locale?: string }) => wrap(() => loadBrowse(opts, locale)))
  ipcMain.handle('api:categories', (_e, { locale }: { locale?: string }) => wrap(() => loadCategories(locale)))
  ipcMain.handle('api:seasons', (_e, { locale }: { locale?: string }) => wrap(() => loadSeasons(locale)))
  ipcMain.handle('api:history', (_e, { locale }: { locale?: string }) => wrap(() => loadHistory(locale)))
  ipcMain.handle('api:stream', (_e, { id }: { id: string }) => wrap(() => resolveStream(id)))
  ipcMain.handle('api:streamRelease', (_e, { contentId, videoToken }: { contentId: string; videoToken: string }) => wrap(() => releaseStream(contentId, videoToken)))
  ipcMain.handle('api:playhead', (_e, { contentId, playhead }: { contentId: string; playhead: number }) => wrap(() => setPlayhead(contentId, playhead)))
  ipcMain.handle('device:code', () => wrap(() => requestDeviceCode()))
  ipcMain.handle('device:poll', (_e, { device_code }: { device_code: string }) => wrap(() => pollDeviceToken(device_code)))
}
