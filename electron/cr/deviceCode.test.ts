import { describe, it, expect } from 'vitest'
import { mapDeviceCodeResponse } from './deviceCode'

describe('mapDeviceCodeResponse', () => {
  it('maps a full response and keeps the complete URI distinct from the bare one', () => {
    const m = mapDeviceCodeResponse({
      device_code: 'dev-123',
      user_code: '7nh4kq',
      verification_uri: 'https://www.crunchyroll.com/activate',
      verification_uri_complete: 'https://www.crunchyroll.com/activate?code=7NH4KQ',
      expires_in: 600,
      polling_interval: 5
    })
    expect(m).toEqual({
      device_code: 'dev-123',
      user_code: '7nh4kq',
      verification_uri: 'https://www.crunchyroll.com/activate',
      verification_uri_complete: 'https://www.crunchyroll.com/activate?code=7NH4KQ',
      expires_in: 600,
      interval: 5
    })
  })

  it('falls back complete -> bare when verification_uri_complete is absent', () => {
    const m = mapDeviceCodeResponse({
      device_code: 'd',
      user_code: 'abcdef',
      verification_uri: 'https://www.crunchyroll.com/activate'
    })
    expect(m.verification_uri_complete).toBe('https://www.crunchyroll.com/activate')
    expect(m.verification_uri).toBe('https://www.crunchyroll.com/activate')
  })

  it('falls back both URIs to the default activate URL when none provided', () => {
    const m = mapDeviceCodeResponse({ device_code: 'd', user_code: 'x' })
    expect(m.verification_uri).toBe('https://www.crunchyroll.com/activate')
    expect(m.verification_uri_complete).toBe('https://www.crunchyroll.com/activate')
  })

  it('prefers polling_interval over interval and defaults expires_in to 300', () => {
    expect(mapDeviceCodeResponse({ polling_interval: 7, interval: 99 }).interval).toBe(7)
    expect(mapDeviceCodeResponse({ interval: 9 }).interval).toBe(9)
    expect(mapDeviceCodeResponse({}).interval).toBe(5)
    expect(mapDeviceCodeResponse({}).expires_in).toBe(300)
  })
})
