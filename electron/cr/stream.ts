import { crFetch, CR } from './client.js'
import { accessToken } from './auth.js'

// Resolve an episode's playable stream (DASH manifest + Widevine DRM token) from the
// TV play service. The renderer needs the access token too, for Bearer on manifest/segments.
export async function resolveStream(episodeId: string) {
  const token = await accessToken()
  const play: any = await crFetch(`${CR.PLAY}/v1/${episodeId}/tv/samsung/play`, { bearer: token })
  return {
    accessToken: token,
    contentId: episodeId,
    assetId: play.assetId,
    videoToken: play.token,
    manifestUrl: play.url,
    drmUrl: play?.drm?.drmUrl, // current Widevine license URL (the hardcoded base one is stale)
    audioLocale: play.audioLocale,
    hardSubs: play.hardSubs ?? {}
  }
}

// Free the stream slot when playback ends (CR caps concurrent streams).
export async function releaseStream(contentId: string, videoToken: string) {
  if (!contentId || !videoToken) return
  const token = await accessToken()
  try {
    await crFetch(`${CR.PLAY}/v1/token/${contentId}/${videoToken}`, { method: 'DELETE', bearer: token })
  } catch {
    /* best effort */
  }
}
