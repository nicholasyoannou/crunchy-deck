// Pure, Electron-free helpers for the genre/category list. v2 discover/categories is the
// lead; v1 tenant_categories (single-call, nested subcategories) is the fallback. Both are
// normalised to a uniform { id, title } the chips render and pass to Browse as categories=.

export interface Category {
  id: string
  title: string
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
      return { id, title: r.localization?.title ?? r.title ?? id }
    })
    .filter((c: Category) => !!c.id)
}
