import { crFetch, CR } from './client.js'
import { accessToken, accountId } from './auth.js'
import {
  watchlistListUrl,
  watchlistCheckUrl,
  watchlistAddUrl,
  watchlistRemoveUrl,
  isInWatchlist,
  watchlistItems
} from './watchlistShape.js'

// The user's saved watchlist as mapItems-ready rows (each carries content under .panel).
export async function loadWatchlist(locale = 'en-US', n = 200, start = 0) {
  const token = await accessToken()
  const id = accountId()
  const res: any = await crFetch(watchlistListUrl(CR.API, id, locale, n, start), { bearer: token })
  return watchlistItems(res)
}

// Whether one series/movie is already saved (drives the series-page bookmark state).
export async function checkWatchlist(contentId: string, locale = 'en-US') {
  const token = await accessToken()
  const id = accountId()
  const res: any = await crFetch(watchlistCheckUrl(CR.API, id, contentId, locale), { bearer: token })
  return isInWatchlist(res)
}

// Add — the reference-proven /content/v2/{id}/ form first, /discover/ form on a 404
// (the two endpoint generations disagree on where account_id sits; see watchlistShape).
export async function addWatchlist(contentId: string, locale = 'en-US') {
  const token = await accessToken()
  const id = accountId()
  try {
    await crFetch(watchlistAddUrl(CR.API, id, locale), { bearer: token, json: { content_id: contentId } })
  } catch (e: any) {
    if (e?.status === 404) {
      await crFetch(watchlistAddUrl(CR.API, id, locale, true), { bearer: token, json: { content_id: contentId } })
    } else throw e
  }
  return true // now in list
}

export async function removeWatchlist(contentId: string, locale = 'en-US') {
  const token = await accessToken()
  const id = accountId()
  await crFetch(watchlistRemoveUrl(CR.API, id, contentId, locale), { bearer: token, method: 'DELETE' })
  return false // no longer in list
}
