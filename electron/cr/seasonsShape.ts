// Pure, Electron-free helpers for the simulcast/seasonal picker. The list comes from
// discover/seasonal_tags (data[0] = current season); a chosen id feeds Browse as seasonal_tag.

export interface SeasonTag {
  id: string
  title: string
}

export function seasonalTagsUrl(base: string, locale: string): string {
  return `${base}/content/v2/discover/seasonal_tags?locale=${locale}`
}

export function mapSeasonalTags(res: any): SeasonTag[] {
  const rows = Array.isArray(res?.data) ? res.data : []
  return rows
    .map((r: any) => ({ id: r.id, title: r.localization?.title ?? r.id }))
    .filter((s: SeasonTag) => !!s.id)
}
