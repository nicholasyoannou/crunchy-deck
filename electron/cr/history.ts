import { crFetch, CR } from './client.js'
import { accessToken, accountId } from './auth.js'
import { watchHistoryUrl, historyItems } from './historyShape.js'

// The user's watch history (recently-played episodes), mapItems-ready. Each row's panel is an
// episode whose episode_metadata.series_id mapItems uses to link back to the series.
export async function loadHistory(locale = 'en-US', page = 1, pageSize = 100) {
  const token = await accessToken()
  const id = accountId()
  const res: any = await crFetch(watchHistoryUrl(CR.API, id, locale, pageSize, page), { bearer: token })
  return historyItems(res)
}
