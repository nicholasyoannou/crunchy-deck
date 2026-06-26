import { crFetch, CR } from './client.js'
import { accessToken, accountId } from './auth.js'

// rows are panels whose response_type is one of these (must match renderer src/lib/api/map.ts)
const ROW_TYPES = new Set(['recommendations', 'history', 'browse', 'series', 'because_you_watched'])

/**
 * Two-step load: home_feed gives panels with ids/links only, so we fetch each row's
 * actual items. Returns the raw feed + items aligned to the FILTERED row order; the
 * renderer's mapHome(feed, itemsByRow) turns it into view models.
 */
export async function loadHome(locale = 'en-US') {
  const token = await accessToken()
  const id = accountId()

  let audio = 'ja-JP'
  try {
    const profile: any = await crFetch(`${CR.API}/accounts/v1/me/profile`, { bearer: token })
    audio = profile.preferred_content_audio_language || audio
  } catch {
    /* default audio */
  }

  const feed: any = await crFetch(
    `${CR.API}/content/v2/discover/${id}/home_feed?start=0&n=100&preferred_audio_language=${audio}&locale=${locale}`,
    { bearer: token }
  )

  const rowPanels: any[] = (feed?.data ?? []).filter((p: any) => ROW_TYPES.has(p?.response_type))

  const itemsByRow = await Promise.all(
    rowPanels.map(async (panel: any) => {
      try {
        let url: string
        if (panel.resource_type === 'dynamic_collection') {
          url = panel.link?.startsWith('http') ? panel.link : `${CR.API}${panel.link}`
        } else {
          url = `${CR.API}/content/v2/cms/objects/${(panel.ids ?? []).join(',')}?locale=${locale}`
        }
        const res: any = await crFetch(url, { bearer: token })
        return res?.data ?? []
      } catch {
        return []
      }
    })
  )

  // Hero banner: current-season popular simulcasts (dynamic; the TV home_feed only
  // serves a stale 2023 "backup" carousel). seasonal_tags[0] is the current season.
  let heroItems: any[] = []
  try {
    const tags: any = await crFetch(`${CR.API}/content/v2/discover/seasonal_tags?locale=${locale}`, { bearer: token })
    const tag = tags?.data?.[0]?.id
    if (tag) {
      const browse: any = await crFetch(
        `${CR.API}/content/v1/browse?season_tag=${tag}&sort_by=popularity&n=12&locale=${locale}`,
        { bearer: token }
      )
      heroItems = browse?.items ?? browse?.data ?? []
    }
  } catch {
    /* keep the feed even if the hero fetch fails */
  }

  return { feed, itemsByRow, heroItems }
}
