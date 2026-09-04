import { describe, expect, it } from 'vitest'
import { isCrunchyrollCdnUrl } from './crunchyrollRequests'

describe('isCrunchyrollCdnUrl', () => {
  it('recognizes every signed media host used by the player', () => {
    expect(isCrunchyrollCdnUrl('https://vod.crunchyrollcdn.com/v.m4s')).toBe(true)
    expect(isCrunchyrollCdnUrl('https://edge.gccrunchyroll.com/v.m4s')).toBe(true)
    expect(isCrunchyrollCdnUrl('https://cdn.vrv.co/v.m4s')).toBe(true)
    expect(isCrunchyrollCdnUrl('https://cdn.akamaized.net/v.m4s')).toBe(true)
    expect(isCrunchyrollCdnUrl('https://cr-license-proxy.prd.crunchyrollsvc.com/v1/license/widevine')).toBe(false)
  })
})
