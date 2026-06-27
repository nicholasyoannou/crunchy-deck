// Pure, Electron-free helpers for the genre/category list. v2 discover/categories is the
// lead; v1 tenant_categories (single-call, nested subcategories) is the fallback. Both are
// normalised to a uniform { id, title } the chips render and pass to Browse as categories=.

export interface Category {
  id: string
  title: string
  image?: string // per-genre backdrop (largest variant of images.background), for the categories screen
}

// CR returns a per-category artwork set the chips screen can use as a backdrop. The variants live in
// images.background (or images.low) as a flat array [{source,width,height}] — newer responses nest it
// one level (array-of-arrays) like panel images. Grab the largest variant defensively.
function catImage(r: any): string | undefined {
  const set = r?.images?.background ?? r?.images?.low ?? r?.images?.poster_wide
  if (!Array.isArray(set) || set.length === 0) return undefined
  const variants = Array.isArray(set[0]) ? set[0] : set
  return variants[variants.length - 1]?.source
}

export function categoriesUrl(base: string, locale: string): string {
  return `${base}/content/v2/discover/categories?locale=${locale}`
}

export function categoriesUrlV1(base: string, locale: string): string {
  return `${base}/content/v1/tenant_categories?include_subcategories=true&locale=${locale}`
}

export function mapCategories(res: any): Category[] {
  const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : []
  return rows
    .map((r: any) => {
      const id = r.id ?? r.tenant_category
      const title = r.localization?.title ?? r.title ?? id
      const image = catImage(r)
      return image ? { id, title, image } : { id, title } // omit image when absent (keeps {id,title} shape)
    })
    .filter((c: Category) => !!c.id)
}
