import { crFetch, CR } from './client.js'
import { accessToken } from './auth.js'
import { seasonalTagsUrl, mapSeasonalTags } from './seasonsShape.js'

// Simulcast/seasonal picker list (data[0] = current season). A chosen id feeds Browse
// as seasonal_tag. Already proven against the API in home.ts's hero fallback.
export async function loadSeasons(locale = 'en-US') {
  const token = await accessToken()
  const res: any = await crFetch(seasonalTagsUrl(CR.API, locale), { bearer: token })
  return mapSeasonalTags(res)
}
