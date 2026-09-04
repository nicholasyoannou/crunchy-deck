/** Media CDNs use signed URLs and must not receive the account bearer token. */
export function isCrunchyrollCdnUrl(url: string): boolean {
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
