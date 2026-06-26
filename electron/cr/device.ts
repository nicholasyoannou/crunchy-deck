import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { crFetch, CR, CrError } from './client.js'
import { adoptToken } from './auth.js'

// Endpoints + fields recovered from the official APK dex:
//   POST /auth/v1/device/code  -> { device_code, user_code, expires_in, polling_interval }
//   POST /auth/v1/device/token -> { access_token, refresh_token, account_id, ... }  (poll)
const DEVICE_TYPE = 'Crunchyroll for Linux'
const DEVICE_NAME = 'Crunchy Deck'

function deviceId(): string {
  const f = path.join(app.getPath('userData'), 'device_id.txt')
  try {
    if (existsSync(f)) return readFileSync(f, 'utf8').trim()
  } catch {
    /* regenerate */
  }
  const id = randomUUID()
  try {
    writeFileSync(f, id)
  } catch {
    /* non-fatal */
  }
  return id
}

export interface DeviceCode {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export async function requestDeviceCode(): Promise<DeviceCode> {
  const r: any = await crFetch(`${CR.API}/auth/v1/device/code`, {
    clientAuth: true,
    form: { device_id: deviceId(), device_type: DEVICE_TYPE, device_name: DEVICE_NAME }
  })
  console.log('[device] /code response:', JSON.stringify(r))
  return {
    device_code: r.device_code,
    user_code: r.user_code,
    verification_uri: r.verification_uri_complete || r.verification_uri || 'https://www.crunchyroll.com/activate',
    expires_in: r.expires_in ?? 300,
    interval: r.polling_interval ?? r.interval ?? 5
  }
}

export type PollStatus =
  | { status: 'ok' }
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'expired' }
  | { status: 'error'; error: string }

export async function pollDeviceToken(device_code: string): Promise<PollStatus> {
  try {
    // /device/token wants a JSON body (not form like /device/code) and no grant_type.
    // While the user hasn't authorized yet, CR replies HTTP 200 with an EMPTY body
    // (json === undefined) — that is the "pending" signal, not an error.
    const json: any = await crFetch(`${CR.API}/auth/v1/device/token`, {
      clientAuth: true,
      json: { device_id: deviceId(), device_code }
    })
    if (json && json.access_token) {
      console.log('[device] /token authorized')
      adoptToken(json)
      return { status: 'ok' }
    }
    return { status: 'pending' }
  } catch (e) {
    if (e instanceof CrError) {
      console.log(`[device] /token err status=${e.status} body=${e.message.slice(0, 300)}`)
      const low = e.message.toLowerCase()
      if (low.includes('expired')) return { status: 'expired' }
      if (low.includes('too_many') || low.includes('slow_down')) return { status: 'slow_down' }
      if (low.includes('denied') || low.includes('invalid_client') || low.includes('not_found') || low.includes('inactive'))
        return { status: 'error', error: e.message.slice(0, 200) }
      // generic 4xx during polling = still waiting for the user to authorize
      return { status: 'pending' }
    }
    console.log('[device] /token non-http err:', String(e).slice(0, 200))
    return { status: 'error', error: String(e).slice(0, 200) }
  }
}
