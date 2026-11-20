import { scoreProduct, type Department, type ProductView } from '@thulir/shared'

export type SortKey = 'relevance' | 'priceLow' | 'priceHigh' | 'name' | 'discount'

export interface ProductFilter {
  query: string
  department: Department | 'all'
  brand: string | 'all'
  /** Maximum price in paise; null means any. */
  maxPricePaise: number | null
  onOffer: boolean
  vegOnly: boolean
  sort: SortKey
}

export const DEFAULT_FILTER: ProductFilter = {
  query: '',
  department: 'all',
  brand: 'all',
  maxPricePaise: null,
  onOffer: false,
  vegOnly: false,
  sort: 'relevance',
}

export const PRICE_STEPS_PAISE = [5000, 10000, 25000, 50000] as const

/**
 * Filter + sort a store's products. Sold-out items always sort after sellable ones within the same ordering,
 * so what a customer can actually buy is never buried under what they cannot.
 */
export function applyProductFilter(products: ProductView[], f: ProductFilter): ProductView[] {
  const scored: { p: ProductView; score: number }[] = []
  for (const p of products) {
    if (f.department !== 'all' && p.department !== f.department) continue
    if (f.brand !== 'all' && p.brand !== f.brand) continue
    if (f.maxPricePaise !== null && p.pricePaise > f.maxPricePaise) continue
    if (f.onOffer && p.discountPercent <= 0) continue
    if (f.vegOnly && !p.veg) continue
    let score = 0
    if (f.query.trim()) {
      score = scoreProduct(p, f.query)
      if (score === 0) continue
    }
    scored.push({ p, score })
  }

  const sellableFirst = (a: ProductView, b: ProductView) =>
    Number(b.eligibility.sellable) - Number(a.eligibility.sellable)

  const byName = (a: ProductView, b: ProductView) => a.name.en.localeCompare(b.name.en)
  scored.sort((x, y) => {
    const s = sellableFirst(x.p, y.p)
    if (s !== 0) return s
    switch (f.sort) {
      case 'priceLow':
        return x.p.pricePaise - y.p.pricePaise || byName(x.p, y.p)
      case 'priceHigh':
        return y.p.pricePaise - x.p.pricePaise || byName(x.p, y.p)
      case 'name':
        return byName(x.p, y.p)
      case 'discount':
        return y.p.discountPercent - x.p.discountPercent || byName(x.p, y.p)
      default:
        return y.score - x.score || byName(x.p, y.p)
    }
  })
  return scored.map((x) => x.p)
}

export function brandsOf(products: ProductView[]): string[] {
  return [...new Set(products.map((p) => p.brand))].sort((a, b) => a.localeCompare(b))
}
