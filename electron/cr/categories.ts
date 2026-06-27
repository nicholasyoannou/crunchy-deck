import { crFetch, CR } from './client.js'
import { accessToken } from './auth.js'
import { categoriesUrl, categoriesUrlV1, mapCategories } from './categoriesShape.js'

// Genre/category list for the Browse picker. v2 discover/categories first, v1 tenant_categories
// (single nested call) as the fallback when v2 errors or returns nothing.
export async function loadCategories(locale = 'en-US') {
  const token = await accessToken()
  try {
    const res: any = await crFetch(categoriesUrl(CR.API, locale), { bearer: token })
    const cats = mapCategories(res)
    if (cats.length) return cats
    throw new Error('empty')
  } catch {
    const res: any = await crFetch(categoriesUrlV1(CR.API, locale), { bearer: token })
    return mapCategories(res)
  }
}
