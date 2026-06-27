import { crFetch, CR } from './client.js'
import { accessToken } from './auth.js'
import { browseUrl, browseUrlV1, browseItems, type BrowseOpts } from './browseShape.js'

export type { BrowseOpts } from './browseShape.js'

// Catalog browse (sort + optional categories/seasonal_tag filters), mapItems-ready.
// Leads with v2 discover/browse; on error falls back to the v1 path proven in home.ts.
export async function loadBrowse(opts: BrowseOpts = {}, locale = 'en-US') {
  const token = await accessToken()
  try {
    const res: any = await crFetch(browseUrl(CR.API, locale, opts), { bearer: token })
    return browseItems(res)
  } catch {
    const res: any = await crFetch(browseUrlV1(CR.API, locale, opts), { bearer: token })
    return browseItems(res)
  }
}
