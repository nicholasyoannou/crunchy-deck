import { cdnHeaders, isCdnUrl, licenseHeaders } from './client.js'

export type RequestHeaders = Record<string, string | string[]>

function remove(headers: RequestHeaders, names: string[]): void {
  const targets = new Set(names.map((name) => name.toLowerCase()))
  for (const name of Object.keys(headers)) {
    if (targets.has(name.toLowerCase())) delete headers[name]
  }
}

function assign(headers: RequestHeaders, values: Record<string, string>): void {
  remove(headers, Object.keys(values))
  Object.assign(headers, values)
}

export function isLicenseUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      (parsed.hostname.endsWith('.crunchyrollsvc.com') || parsed.hostname === 'www.crunchyroll.com') &&
      parsed.pathname.toLowerCase().includes('/license')
    )
  } catch {
    return false
  }
}

/** Apply the required media header profiles.
 * API/license requests keep their bearer token; signed CDN requests never do. */
export function rewriteRendererRequestHeaders(url: string, input: RequestHeaders): RequestHeaders {
  const headers = { ...input }
  remove(headers, ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'])

  if (isCdnUrl(url)) {
    remove(headers, ['authorization', 'origin', 'referer', 'user-agent', 'accept', 'accept-language', 'accept-encoding'])
    assign(headers, cdnHeaders())
  } else if (isLicenseUrl(url)) {
    remove(headers, ['origin', 'referer', 'user-agent', 'accept'])
    assign(headers, licenseHeaders())
  } else {
    // TV API/playback requests do not send browser navigation provenance.
    remove(headers, ['origin', 'referer'])
  }
  return headers
}
