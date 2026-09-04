import { describe, expect, it } from 'vitest'
import { CR, cdnHeaders, crHeaders, isCdnUrl, licenseHeaders, normalizeLicenseUrl } from './client'
import { rewriteRendererRequestHeaders } from './requestHeaders'

describe('Crunchyroll TV headers', () => {
  it('sends the Tizen API profile without Chromium client hints', () => {
    const headers = crHeaders({ authorization: 'Bearer token' })
    expect(headers['User-Agent']).toContain('SMART-TV')
    expect(headers.Authorization).toBe('Bearer token')
    expect(headers.Accept).toBe('application/json, text/plain, */*')
    expect(headers['Accept-Language']).toBe('en-US,en;q=0.9')
    expect(headers['sec-ch-ua']).toBeUndefined()
  })

  it('uses Crunchyroll hotlink headers without authorization for every media CDN', () => {
    const headers = cdnHeaders()
    expect(headers.Origin).toBe('https://www.crunchyroll.com')
    expect(headers.Referer).toBe('https://www.crunchyroll.com/')
    expect(headers['Accept-Encoding']).toBe('identity')
    expect(headers.Authorization).toBeUndefined()
    expect(isCdnUrl('https://vod.crunchyrollcdn.com/a.m4s')).toBe(true)
    expect(isCdnUrl('https://edge.gccrunchyroll.com/a.m4s')).toBe(true)
    expect(isCdnUrl(`${CR.PLAY}/v1/id/tv/samsung/play`)).toBe(false)
  })

  it('uses the static Crunchyroll origin for Widevine licenses', () => {
    expect(licenseHeaders()).toMatchObject({
      Origin: 'https://static.crunchyroll.com',
      Referer: 'https://static.crunchyroll.com/'
    })
    expect(normalizeLicenseUrl('https://www.crunchyroll.com/license/v1/license/widevine?specconform=true')).toBe(
      'https://www.crunchyroll.com/license/v1/license/widevine'
    )
    expect(normalizeLicenseUrl(undefined)).toBe(CR.LICENSE)
  })

  it('removes bearer and client hints only from signed CDN requests', () => {
    const rewritten = rewriteRendererRequestHeaders('https://edge.gccrunchyroll.com/v.m4s', {
      Authorization: 'Bearer secret',
      'Sec-Ch-Ua-Platform': '"Windows"',
      Range: 'bytes=0-10'
    })
    expect(rewritten.Authorization).toBeUndefined()
    expect(rewritten['Sec-Ch-Ua-Platform']).toBeUndefined()
    expect(rewritten.Range).toBe('bytes=0-10')
    expect(rewritten.Referer).toBe('https://www.crunchyroll.com/')
  })

  it('removes browser provenance from ordinary TV playback requests', () => {
    const rewritten = rewriteRendererRequestHeaders(`${CR.PLAY}/v1/id/tv/samsung/play`, {
      Authorization: 'Bearer token',
      Origin: 'http://127.0.0.1:5173',
      Referer: 'http://127.0.0.1:5173/'
    })
    expect(rewritten.Authorization).toBe('Bearer token')
    expect(rewritten.Origin).toBeUndefined()
    expect(rewritten.Referer).toBeUndefined()
  })
})
