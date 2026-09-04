// Low-level Crunchyroll HTTP. Runs in the MAIN process (Node fetch) so there is no
// CORS, the Tizen-TV User-Agent is set freely, and tokens never reach the renderer.

export const CR = {
  API: 'https://beta-api.crunchyroll.com',
  STATIC: 'https://static.crunchyroll.com',
  PLAY: 'https://cr-play-service.prd.crunchyrollsvc.com',
  LICENSE: 'https://cr-license-proxy.prd.crunchyrollsvc.com/v1/license/widevine',
  // Samsung-TV client credentials (client_id:client_secret), base64 — from the base project.
  CLIENT_AUTH: 'Basic eHVuaWh2ZWRidDNtYmlzdWhldnQ6MWtJUzVkeVR2akUwX3JxYUEzWWVBaDBiVVhVbXhXMTE=',
  UA: 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36'
}

export class CrError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'CrError'
  }
}

interface FetchOpts {
  method?: string
  form?: Record<string, string>
  json?: unknown
  bearer?: string
  clientAuth?: boolean
  headers?: Record<string, string>
}

export interface HeaderOptions {
  authorization?: string
  contentType?: string
  extra?: Record<string, string>
}

/** Headers sent by the Samsung/Tizen Crunchyroll client for API requests. */
export function crHeaders(opts: HeaderOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': CR.UA,
    Accept: opts.contentType ? 'application/json' : 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br'
  }
  if (opts.authorization) headers.Authorization = opts.authorization
  if (opts.contentType) headers['Content-Type'] = opts.contentType
  if (opts.extra) Object.assign(headers, opts.extra)
  return headers
}

/** Signed media URLs are hotlink-protected and reject the account bearer token. */
export function cdnHeaders(): Record<string, string> {
  return {
    'User-Agent': CR.UA,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'identity',
    Origin: 'https://www.crunchyroll.com',
    Referer: 'https://www.crunchyroll.com/'
  }
}

/** Headers shared by both Widevine license endpoints used by Crunchyroll. */
export function licenseHeaders(): Record<string, string> {
  return {
    'User-Agent': CR.UA,
    Accept: 'application/json, application/octet-stream, */*',
    Origin: CR.STATIC,
    Referer: `${CR.STATIC}/`
  }
}

export function normalizeLicenseUrl(raw: unknown): string {
  const value = typeof raw === 'string' && raw ? raw : CR.LICENSE
  return value.replace(/[?&]specconform=true/gi, '').replace(/\?$/, '')
}

export function isCdnUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    const isHost = (domain: string) => host === domain || host.endsWith(`.${domain}`)
    return (
      isHost('crunchyrollcdn.com') ||
      isHost('gccrunchyroll.com') ||
      isHost('vrv.co') ||
      isHost('akamaized.net')
    )
  } catch {
    return false
  }
}

export async function crFetch<T = any>(url: string, opts: FetchOpts = {}): Promise<T> {
  let body: string | undefined
  let contentType: string | undefined

  const authorization = opts.clientAuth ? CR.CLIENT_AUTH : opts.bearer ? `Bearer ${opts.bearer}` : undefined

  if (opts.form) {
    contentType = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(opts.form).toString()
  } else if (opts.json !== undefined) {
    contentType = 'application/json'
    body = JSON.stringify(opts.json)
  }

  const headers = crHeaders({ authorization, contentType, extra: opts.headers })
  const res = await fetch(url, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body })
  const text = await res.text()
  if (!res.ok) throw new CrError(res.status, text.slice(0, 500))
  return (text ? JSON.parse(text) : undefined) as T
}
