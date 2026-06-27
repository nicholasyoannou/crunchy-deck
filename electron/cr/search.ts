import { crFetch, CR } from './client.js'
import { accessToken } from './auth.js'
import { buildSearchUrl, flattenSearchResults } from './searchShape.js'

// Full-text search over series + movies. Returns a flat list of CR content objects
// (mapItems-ready); the grouped per-type buckets are flattened in searchShape.
export async function loadSearch(query: string, locale = 'en-US') {
  const q = query.trim()
  if (!q) return [] // empty query -> no wasted round-trip
  const token = await accessToken()
  const res: any = await crFetch(buildSearchUrl(CR.API, q, locale), { bearer: token })
  return flattenSearchResults(res)
}
