import { isOpenAt, type StoreCategory, type StoreWithDelivery } from '@thulir/shared'

export interface StoreFilter {
  query: string
  categories: StoreCategory[]
  openNow: boolean
  fast: boolean
  offers: boolean
  nearby: boolean
}

export const FAST_ETA_MIN = 30
export const NEARBY_M = 1000

/** Normalise for forgiving matching: case-folded, diacritics stripped. Tamil is left intact. */
function norm(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function matchesFilter(store: StoreWithDelivery, f: StoreFilter, now: Date = new Date()): boolean {
  if (f.categories.length && !f.categories.includes(store.category)) return false
  if (f.openNow && !isOpenAt(store.hours, now)) return false
  if (f.fast && store.delivery.etaMin > FAST_ETA_MIN) return false
  if (f.offers && store.offers.length === 0) return false
  if (f.nearby && store.delivery.distanceM > NEARBY_M) return false
  const q = norm(f.query)
  if (q) {
    // Both languages are always searched, so an English query still finds a store while the UI is Tamil.
    const hay = norm(
      [store.name.en, store.name.ta, store.tagline.en, store.tagline.ta, store.category.replace('_', ' ')].join(' '),
    )
    if (!hay.includes(q)) return false
  }
  return true
}

export function filterStores(stores: StoreWithDelivery[], f: StoreFilter, now?: Date): StoreWithDelivery[] {
  return stores.filter((s) => matchesFilter(s, f, now)).sort((a, b) => Number(b.delivery.deliverable) - Number(a.delivery.deliverable) || a.delivery.distanceM - b.delivery.distanceM)
}
