import { app, safeStorage } from 'electron'
import { writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { crFetch, CR } from './client.js'

interface Persisted {
  refresh_token: string
  account_id: string
}
interface TokenState extends Persisted {
  access_token: string
  expiresAt: number
  country?: string
}

let state: TokenState | null = null

function sessionFile() {
  return path.join(app.getPath('userData'), 'session.bin')
}

function persist(refresh_token: string, account_id: string) {
  const json = JSON.stringify({ refresh_token, account_id } satisfies Persisted)
  const enc = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf8')
  writeFileSync(sessionFile(), enc)
}

function loadPersisted(): Persisted | null {
  try {
    if (!existsSync(sessionFile())) return null
    const buf = readFileSync(sessionFile())
    const json = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function adoptToken(json: any) {
  state = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    account_id: json.account_id,
    country: json.country,
    expiresAt: Date.now() + (json.expires_in ?? 0) * 1000 - 30_000 // 30s safety margin
  }
  persist(state.refresh_token, state.account_id)
}

async function refresh(refresh_token: string) {
  const json = await crFetch(`${CR.API}/auth/v1/token`, {
    clientAuth: true,
    form: { refresh_token, grant_type: 'refresh_token', scope: 'offline_access' }
  })
  adoptToken(json)
}

export async function login(username: string, password: string) {
  const json = await crFetch(`${CR.API}/auth/v1/token`, {
    clientAuth: true,
    form: { username, password, grant_type: 'password', scope: 'offline_access' }
  })
  adoptToken(json)
  return { authenticated: true, account_id: state!.account_id, country: state!.country }
}

export async function accessToken(): Promise<string> {
  if (!state) {
    const p = loadPersisted()
    if (!p) throw new Error('not_authenticated')
    await refresh(p.refresh_token)
  } else if (Date.now() >= state.expiresAt) {
    await refresh(state.refresh_token)
  }
  return state!.access_token
}

export function accountId(): string {
  if (!state) throw new Error('not_authenticated')
  return state.account_id
}

export async function status() {
  if (!state) {
    const p = loadPersisted()
    if (!p) return { authenticated: false }
    try {
      await refresh(p.refresh_token)
    } catch {
      return { authenticated: false }
    }
  }
  return { authenticated: true, account_id: state!.account_id, country: state!.country }
}

export function logout() {
  state = null
  try {
    rmSync(sessionFile(), { force: true })
  } catch {
    /* ignore */
  }
}
