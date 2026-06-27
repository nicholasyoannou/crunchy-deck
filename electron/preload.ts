import { contextBridge, ipcRenderer } from 'electron'

// Steam exports these into the env when it launches the app; their presence means the Steam
// on-screen keyboard + Steam Input are available. Absent -> use the in-app keyboard failover.
const env = (typeof process !== 'undefined' && process.env) || {}
const launchedViaSteam = !!(
  env.SteamEnv ||
  env.SteamGameId ||
  env.SteamAppId ||
  env.SteamClientLaunch ||
  env.SteamOverlayGameId
)

contextBridge.exposeInMainWorld('cr', {
  version: process.versions.electron,
  steam: launchedViaSteam,
  log: (m: string) => ipcRenderer.send('cr:log', m),
  quit: () => ipcRenderer.send('app:quit'),
  auth: {
    login: (username: string, password: string) => ipcRenderer.invoke('auth:login', { username, password }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    status: () => ipcRenderer.invoke('auth:status'),
    profiles: () => ipcRenderer.invoke('auth:profiles'),
    switchProfile: (profile_id: string) => ipcRenderer.invoke('auth:switchProfile', { profile_id })
  },
  api: {
    home: (locale = 'en-US') => ipcRenderer.invoke('api:home', { locale }),
    row: (desc: { title: string; link?: string; ids?: string[] }, locale = 'en-US') =>
      ipcRenderer.invoke('api:row', { desc, locale }),
    series: (id: string, locale = 'en-US') => ipcRenderer.invoke('api:series', { id, locale }),
    heroDetail: (id: string, locale = 'en-US') => ipcRenderer.invoke('api:heroDetail', { id, locale }),
    episodes: (seasonId: string, locale = 'en-US') => ipcRenderer.invoke('api:episodes', { seasonId, locale }),
    search: (query: string, locale = 'en-US') => ipcRenderer.invoke('api:search', { query, locale }),
    watchlist: (locale = 'en-US') => ipcRenderer.invoke('api:watchlist', { locale }),
    watchlistCheck: (contentId: string, locale = 'en-US') => ipcRenderer.invoke('api:watchlistCheck', { contentId, locale }),
    watchlistAdd: (contentId: string, locale = 'en-US') => ipcRenderer.invoke('api:watchlistAdd', { contentId, locale }),
    watchlistRemove: (contentId: string, locale = 'en-US') => ipcRenderer.invoke('api:watchlistRemove', { contentId, locale }),
    browse: (
      opts: { sortBy?: string; type?: string; categories?: string; seasonalTag?: string; n?: number; start?: number } = {},
      locale = 'en-US'
    ) => ipcRenderer.invoke('api:browse', { opts, locale }),
    categories: (locale = 'en-US') => ipcRenderer.invoke('api:categories', { locale }),
    seasons: (locale = 'en-US') => ipcRenderer.invoke('api:seasons', { locale }),
    history: (locale = 'en-US') => ipcRenderer.invoke('api:history', { locale })
  },
  device: {
    code: () => ipcRenderer.invoke('device:code'),
    poll: (device_code: string) => ipcRenderer.invoke('device:poll', { device_code })
  },
  player: {
    stream: (id: string) => ipcRenderer.invoke('api:stream', { id }),
    release: (contentId: string, videoToken: string) => ipcRenderer.invoke('api:streamRelease', { contentId, videoToken }),
    setPlayhead: (contentId: string, playhead: number) => ipcRenderer.invoke('api:playhead', { contentId, playhead }),
    markers: (id: string) => ipcRenderer.invoke('api:skipMarkers', { id }),
    nextEpisode: (id: string, locale = 'en-US') => ipcRenderer.invoke('api:nextEpisode', { id, locale })
  },
  update: {
    onAvailable: (cb: (d: { version: string }) => void) => ipcRenderer.on('update:available', (_e, d) => cb(d)),
    onProgress: (cb: (d: { percent: number }) => void) => ipcRenderer.on('update:progress', (_e, d) => cb(d)),
    onDownloaded: (cb: (d: { version: string }) => void) => ipcRenderer.on('update:downloaded', (_e, d) => cb(d)),
    onNone: (cb: () => void) => ipcRenderer.on('update:none', () => cb()),
    onState: (cb: (d: any) => void) => ipcRenderer.on('update:state', (_e, d) => cb(d)),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    check: () => ipcRenderer.invoke('update:check'),
    getState: () => ipcRenderer.invoke('update:getState'),
    setChannel: (channel: 'stable' | 'dev') => ipcRenderer.invoke('update:setChannel', channel)
  }
})
