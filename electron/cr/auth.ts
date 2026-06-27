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
  try {
    const json = await crFetch(`${CR.API}/auth/v1/token`, {
      clientAuth: true,
      form: { refresh_token, grant_type: 'refresh_token', scope: 'offline_access' }
    })
    adoptToken(json)
  } catch (e) {
    // refresh token revoked / signed out elsewhere -> drop the local session so we re-prompt login
    logout()
    throw e
  }
}

export async function login(username: string, password: string) {
  const json = await crFetch(`${CR.API}/auth/v1/token`, {
    clientAuth: true,
    form: { username, password, grant_type: 'password', scope: 'offline_access' }
  })
  adoptToken(json)
  return { authenticated: true, account_id: state!.account_id, country: state!.country }
}

export interface Profile {
  profile_id: string
  profile_name?: string
  username?: string
  avatar?: string
  wallpaper?: string
  is_selected?: boolean
}

// The account's profiles (GET /accounts/v1/me/multiprofile, Bearer-authed).
export async function getProfiles(): Promise<Profile[]> {
  const token = await accessToken()
  const res: any = await crFetch(`${CR.API}/accounts/v1/me/multiprofile`, { bearer: token })
  console.log('[profiles] fields', res?.profiles?.[0] ? Object.keys(res.profiles[0]).join(',') : 'none')
  return res?.profiles ?? []
}

// Re-mint the token scoped to a profile (grant_type=refresh_token_profile_id) and persist it so the
// selection survives restarts. Returns the new account/profile ids.
export async function switchProfile(profile_id: string) {
  await accessToken() // ensures `state` is populated and the refresh token is current
  if (!state) throw new Error('not_authenticated')
  const json = await crFetch(`${CR.API}/auth/v1/token`, {
    clientAuth: true,
    form: { refresh_token: state.refresh_token, grant_type: 'refresh_token_profile_id', profile_id, scope: 'offline_access' }
  })
  adoptToken(json)
  return { profile_id, account_id: state.account_id }
}

// Dedupe concurrent refreshes — CR rotates refresh tokens, so parallel refreshes with the
// same token would invalidate each other and fail all-but-one (breaks lazy row loads).
let inflight: Promise<void> | null = null

function ensureFresh(): Promise<void> {
  if (inflight) return inflight
  if (state && Date.now() < state.expiresAt) return Promise.resolve()
  inflight = (async () => {
    if (!state) {
      const p = loadPersisted()
      if (!p) throw new Error('not_authenticated')
      await refresh(p.refresh_token)
    } else {
      await refresh(state.refresh_token)
    }
  })().finally(() => {
    inflight = null
  })
  return inflight
}

export async function accessToken(): Promise<string> {
  await ensureFresh()
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
