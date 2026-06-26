// Low-level Crunchyroll HTTP. Runs in the MAIN process (Node fetch) so there is no
// CORS, the Tizen-TV User-Agent is set freely, and tokens never reach the renderer.

export const CR = {
  API: 'https://beta-api.crunchyroll.com',
  STATIC: 'https://static.crunchyroll.com',
  PLAY: 'https://cr-play-service.prd.crunchyrollsvc.com',
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
}

export async function crFetch<T = any>(url: string, opts: FetchOpts = {}): Promise<T> {
  const headers: Record<string, string> = { 'User-Agent': CR.UA }
  let body: string | undefined

  if (opts.clientAuth) headers['Authorization'] = CR.CLIENT_AUTH
  else if (opts.bearer) headers['Authorization'] = `Bearer ${opts.bearer}`

  if (opts.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(opts.form).toString()
  } else if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  }

  const res = await fetch(url, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body })
  const text = await res.text()
  if (!res.ok) throw new CrError(res.status, text.slice(0, 500))
  return (text ? JSON.parse(text) : undefined) as T
}
