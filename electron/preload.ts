import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('cr', {
  version: process.versions.electron
})
