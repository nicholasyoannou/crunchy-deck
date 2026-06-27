import { crFetch, CR } from './client.js'
import { accessToken, accountId } from './auth.js'

// Content rows (broadened to the full mobile-style set). Feed order is preserved.
const ROW_TYPES = new Set([
  'recommendations',
  'history',
  'watchlist',
  'recent_episodes',
  'browse',
  'series',
  'music_video',
  'because_you_watched'
])

export interface RowDescriptor {
  title: string
  link?: string
  ids?: string[]
}

// The live curated hero lives in the /f/v1/home server-driven UI tree as HeroMediaCard
// nodes (title/description/contentId/wideImage/logoImage). Walk the tree and collect them.
function extractHeroCards(tree: any): any[] {
  const cards: any[] = []
  const seen = new Set<string>()
  const walk = (n: any) => {
    if (Array.isArray(n)) {
      n.forEach(walk)
      return
    }
    if (n && typeof n === 'object') {
      if (n.type === 'HeroMediaCard' && n.props) {
        const key = String(n.props.contentId ?? n.props.title ?? '')
        if (!seen.has(key)) {
          seen.add(key)
          cards.push(n.props)
        }
      }
      for (const k in n) walk(n[k])
    }
  }
  walk(tree)
  return cards
}

/**
 * Loads only the home SHELL: hero data + row descriptors (titles + how to fetch).
 * Row items are NOT fetched here — each row loads lazily on scroll via loadRow().
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

  const raw = (feed?.data ?? [])
    .filter((p: any) => ROW_TYPES.has(p?.response_type))
    .map((p: any, i: number) => ({
      title: p.title,
      link: p.resource_type === 'dynamic_collection' ? p.link : undefined,
      ids: p.resource_type !== 'dynamic_collection' ? (p.ids ?? undefined) : undefined,
      type: p.response_type as string,
      order: i
    }))
  // Pin "Continue Watching" (history) directly under the hero; everything else keeps feed order.
  raw.sort((a: any, b: any) => (a.type === 'history' ? 0 : 1) - (b.type === 'history' ? 0 : 1) || a.order - b.order)
  const rows: RowDescriptor[] = raw.map((r: any) => ({ title: r.title, link: r.link, ids: r.ids }))

  // Hero: prefer the LIVE curated carousel from /f/v1/home (HeroMediaCard, includes logos).
  let heroCards: any[] = []
  try {
    const tree: any = await crFetch(`https://www.crunchyroll.com/f/v1/home?locale=${locale}`, { bearer: token })
    heroCards = extractHeroCards(tree)
  } catch {
    /* fall back below */
  }

  // Fallback (only if the fragment hero is unavailable): current-season popular simulcasts.
  let heroItems: any[] = []
  if (heroCards.length === 0) {
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
      /* keep the shell even if the hero fetch fails */
    }
  }

  return { feed, heroCards, heroItems, rows }
}

/** Fetches one row's items on demand (dynamic_collection -> link, else cms/objects by ids). */
export async function loadRow(desc: RowDescriptor, locale = 'en-US') {
  const token = await accessToken()
  let url: string
  if (desc.link) {
    url = desc.link.startsWith('http') ? desc.link : `${CR.API}${desc.link}`
  } else if (desc.ids?.length) {
    url = `${CR.API}/content/v2/cms/objects/${desc.ids.join(',')}?locale=${locale}`
  } else {
    return []
  }
  try {
    const res: any = await crFetch(url, { bearer: token })
    return res?.data ?? res?.items ?? []
  } catch {
    return []
  }
}
