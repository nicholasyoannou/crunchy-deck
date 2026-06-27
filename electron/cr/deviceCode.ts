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

export function mapDeviceCodeResponse(r: any): DeviceCode {
  const bare = r?.verification_uri || DEFAULT_ACTIVATE
  return {
    device_code: r?.device_code,
    user_code: r?.user_code,
    verification_uri: bare,
    verification_uri_complete: r?.verification_uri_complete || bare,
    expires_in: r?.expires_in ?? 300,
    interval: r?.polling_interval ?? r?.interval ?? 5
  }
}
