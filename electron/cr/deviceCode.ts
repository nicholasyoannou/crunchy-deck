// Pure mapping of CR's POST /auth/v1/device/code response into our DeviceCode shape.
// No electron / network imports here so it can be unit-tested in isolation.
//
//   verification_uri          -> bare activate URL, shown on the Manual screen
//   verification_uri_complete -> RFC 8628 code-embedded URL, encoded in the QR so a
//                                phone scan signs in automatically. Falls back to the
//                                bare URL when CR omits it (then the QR has no auto-fill).
export interface DeviceCode {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete: string
  expires_in: number
  interval: number
}

const DEFAULT_ACTIVATE = 'https://www.crunchyroll.com/activate'

/** Crunchyroll's Tizen response normally reports milliseconds, while some
 * response variants use seconds. Match the source's bounded conversion. */
export function normalizeIntervalMs(raw: unknown): number {
  const parsed = Number(raw)
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 5000
  const milliseconds = value > 100 ? value : value * 1000
  return Math.min(5000, Math.max(1000, milliseconds))
}

export function mapDeviceCodeResponse(r: any): DeviceCode {
  const bare = r?.verification_uri || DEFAULT_ACTIVATE
  const complete = r?.verification_uri_complete || bare
  const userCode = String(r?.user_code ?? '')
  const withCode = /[?&]code=/.test(complete)
    ? complete
    : `${complete}${complete.includes('?') ? '&' : '?'}code=${encodeURIComponent(userCode)}`
  return {
    device_code: r?.device_code,
    user_code: userCode,
    verification_uri: bare,
    verification_uri_complete: withCode,
    expires_in: r?.expires_in ?? 300,
    interval: normalizeIntervalMs(r?.polling_interval ?? r?.interval)
  }
}
