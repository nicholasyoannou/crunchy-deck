import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('cr', {
  version: process.versions.electron,
  auth: {
    login: (username: string, password: string) => ipcRenderer.invoke('auth:login', { username, password }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    status: () => ipcRenderer.invoke('auth:status')
  },
  api: {
    home: (locale = 'en-US') => ipcRenderer.invoke('api:home', { locale }),
    row: (desc: { title: string; link?: string; ids?: string[] }, locale = 'en-US') =>
      ipcRenderer.invoke('api:row', { desc, locale }),
    series: (id: string, locale = 'en-US') => ipcRenderer.invoke('api:series', { id, locale }),
    episodes: (seasonId: string, locale = 'en-US') => ipcRenderer.invoke('api:episodes', { seasonId, locale })
  },
  device: {
    code: () => ipcRenderer.invoke('device:code'),
    poll: (device_code: string) => ipcRenderer.invoke('device:poll', { device_code })
  }
})
