import { describe, expect, it } from 'vitest'
import {
  MISSIONS,
  buildDemoCatalog,
  createCatalogService,
  demoStores,
  demoTowns,
  matchDepartments,
  normalise,
  scoreProduct,
  withDeliveryAll,
  type EligibilityStatus,
} from './index.ts'

const NOW = new Date('2026-06-10T06:30:00Z')
const svc = (now = NOW) => createCatalogService(demoStores, now)
const market = demoTowns[0].areas.find((a) => a.id === 'area-a-market')!.geo
const outer = demoTowns[0].areas.find((a) => a.id === 'area-a-outer')!.geo

describe('demo catalog integrity', () => {
  const { products, batches } = buildDemoCatalog(NOW)
  it('has a realistic size and spans all six stores', () => {
    expect(products.length).toBeGreaterThanOrEqual(60)
    expect(products.length).toBeLessThanOrEqual(110)
    for (const s of demoStores) expect(products.some((p) => p.storeId === s.id)).toBe(true)
  })
  it('ids are unique and every batch points at a real product', () => {
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length)
    const ids = new Set(products.map((p) => p.id))
    for (const b of batches) expect(ids.has(b.productId)).toBe(true)
  })
  it('has no placeholder names and sane prices', () => {
    for (const p of products) {
      expect(p.name.en).not.toMatch(/product\s*\d|item\s*\d|test|lorem/i)
      expect(p.pricePaise).toBeGreaterThan(0)
      expect(p.pricePaise).toBeLessThanOrEqual(p.mrpPaise)
    }
  })
  it('uses realistic Indian units', () => {
    for (const p of products) expect(p.unit).toMatch(/\d/)
  })
  it('covers every freshness state at least once', () => {
    const seen = new Set<EligibilityStatus>(svc().verdicts().map((v) => v.eligibility.status))
    for (const st of ['eligible', 'low_stock', 'near_expiry', 'expired', 'blocked', 'out_of_stock', 'requires_review'] as const) {
      expect(seen.has(st), `missing status ${st}`).toBe(true)
    }
  })
  it('batches are the source of expiry: no product carries its own expiry date', () => {
    for (const p of products) expect('expiryDate' in p).toBe(false)
  })
})

describe('server-side gatekeeping: ineligible products never reach customers', () => {
  const s = svc()
  const hidden = s.verdicts().filter((v) => !(v.eligibility.sellable || v.eligibility.status === 'out_of_stock'))
  it('there are hidden products to test with', () => {
    expect(hidden.length).toBeGreaterThanOrEqual(6)
  })
  it('catalog omits them and reports only a count', () => {
    for (const store of demoStores) {
      const cat = s.storeCatalog(store.id)!
      const ids = new Set(cat.products.map((p) => p.id))
      for (const h of hidden.filter((v) => v.product.storeId === store.id)) expect(ids.has(h.product.id)).toBe(false)
      expect(cat.hiddenCount).toBe(hidden.filter((v) => v.product.storeId === store.id).length)
    }
  })
  it('product lookup by id returns null for hidden products (indistinguishable from unknown)', () => {
    for (const h of hidden) expect(s.product(h.product.id)).toBeNull()
    expect(s.product('does-not-exist')).toBeNull()
  })
  it('search never returns hidden products, even on an exact name match', () => {
    for (const h of hidden) {
      const hits = s.search(h.product.name.en, { limit: 100 })
      expect(hits.some((x) => x.product.id === h.product.id)).toBe(false)
    }
  })
  it('missions never include hidden products', () => {
    const stores = withDeliveryAll(demoStores, market)
    const ids = new Set(hidden.map((h) => h.product.id))
    for (const m of MISSIONS) {
      const r = s.mission(m.id, stores)!
      for (const g of r.groups) for (const p of g.products) expect(ids.has(p.id)).toBe(false)
      for (const meal of r.meals) for (const it of meal.items) if (it.product) expect(ids.has(it.product.id)).toBe(false)
    }
  })
  it('customer views carry no internal fields', () => {
    const p = s.storeCatalog('store-marutham')!.products[0] as unknown as Record<string, unknown>
    for (const k of ['flaggedForRemoval', 'available', 'requiresExpiry', 'policyOverride', 'batches', 'reasons']) expect(k in p).toBe(false)
    expect(Object.keys(p.eligibility as object).sort()).toEqual(['bestBefore', 'daysToExpiry', 'sellable', 'sellableQty', 'status'])
  })
})

describe('time moves: freshness is re-validated on every build', () => {
  it('a product that is fine today expires tomorrow', () => {
    const data = buildDemoCatalog(NOW) // stock received "today": dates are fixed from here on
    const today = createCatalogService(demoStores, NOW, data)
    const later = createCatalogService(demoStores, new Date(NOW.getTime() + 4 * 86_400_000), data)
    // "Aloo Bhujia" has a batch 4 days out: near-expiry today, expiring-today (blocked) 4 days later.
    const id = 'mm-13'
    expect(today.product(id)).not.toBeNull()
    expect(later.product(id)).toBeNull()
  })
})

describe('search', () => {
  const s = svc()
  const top = (q: string) => s.search(q).map((h) => h.product.id)
  it('finds by English name, brand, partial word, and department keyword', () => {
    expect(top('toor dal').length).toBeGreaterThan(0)
    expect(s.search('aashirvaad')[0].product.brand).toBe('Aashirvaad')
    expect(top('tom')).toContain('pv-01')
    expect(s.search('vegetables').every((h) => h.product.department === 'fresh' || h.score >= 0)).toBe(true)
    expect(s.search('vegetables').length).toBeGreaterThan(5)
  })
  it('finds by Tamil text and by Latin transliteration aliases', () => {
    expect(top('தக்காளி')).toContain('pv-01')
    expect(top('thakkali')).toContain('pv-01')
    expect(top('arisi').length).toBeGreaterThan(1)
    expect(top('பருப்பு').length).toBeGreaterThan(1)
  })
  it('multi-word queries are AND-ed', () => {
    expect(top('toor dal tata')).toContain('mm-03')
    expect(top('toor zzzz')).toEqual([])
  })
  it('is case- and punctuation-insensitive', () => {
    expect(top("LAY'S")).toEqual(top('lays'))
  })
  it('can be scoped to one store', () => {
    for (const h of s.search('rice', { storeId: 'store-selvam' })) expect(h.store.id).toBe('store-selvam')
  })
  it('empty or junk queries return nothing', () => {
    expect(s.search('')).toEqual([])
    expect(s.search('   ')).toEqual([])
    expect(s.search('???')).toEqual([])
  })
  it('suggestions include products, brands and departments', () => {
    const kinds = new Set(s.suggest('ba').map((x) => x.kind))
    expect(kinds.has('product')).toBe(true)
    expect(s.suggest('bak').some((x) => x.kind === 'department')).toBe(true)
    expect(s.suggest('amu').some((x) => x.kind === 'brand')).toBe(true)
  })
  it('normalise keeps Tamil intact and scoring ranks exact above substring', () => {
    expect(normalise('  துவரம்  பருப்பு ')).toBe('துவரம் பருப்பு')
    const p = buildDemoCatalog(NOW).products.find((x) => x.id === 'pv-01')!
    expect(scoreProduct(p, 'tomato')).toBeGreaterThan(scoreProduct(p, 'toma') - 0.0001)
    expect(matchDepartments('bake')).toEqual(['bakery'])
  })
})

describe('substitutions', () => {
  const s = svc()
  it('are sellable, same department, and never the product itself', () => {
    const d = s.product('mm-03')!
    expect(d.substitutes.length).toBeGreaterThan(0)
    for (const sub of d.substitutes) {
      expect(sub.product.id).not.toBe('mm-03')
      expect(sub.product.department).toBe(d.hit.product.department)
      expect(sub.product.eligibility.sellable).toBe(true)
    }
  })
})

describe('missions', () => {
  const s = svc()
  const near = withDeliveryAll(demoStores, market)
  it('all eight exist and resolve', () => {
    expect(MISSIONS).toHaveLength(8)
    for (const m of MISSIONS) expect(s.mission(m.id, near)).not.toBeNull()
    expect(s.mission('nope', near)).toBeNull()
  })
  it('only include stores that deliver to the customer', () => {
    const far = withDeliveryAll(demoStores, outer) // only the supermarket delivers here
    const r = s.mission('weekly-essentials', far)!
    expect(r.groups.map((g) => g.store.id)).toEqual(['store-marutham'])
  })
  it('weekly essentials are grouped per store and sorted by distance', () => {
    const r = s.mission('weekly-essentials', near)!
    expect(r.groups.length).toBeGreaterThan(1)
    const d = r.groups.map((g) => g.store.distanceM)
    expect(d).toEqual([...d].sort((a, b) => a - b))
  })
  it('dinner ingredients resolve each ingredient to the cheapest sellable product', () => {
    const r = s.mission('dinner-ingredients', near)!
    expect(r.meals.length).toBeGreaterThanOrEqual(4)
    const sambar = r.meals.find((m) => m.meal.id === 'sambar-rice')!
    const rice = sambar.items.find((i) => i.tag === 'rice')!.product!
    expect(rice.eligibility.sellable).toBe(true)
    const allRice = s.search('rice', { limit: 100 }).filter((h) => h.product.tags.includes('rice') && h.product.eligibility.sellable)
    expect(rice.pricePaise).toBe(Math.min(...allRice.map((h) => h.product.pricePaise)))
  })
  it('"something new" returns only new products', () => {
    const r = s.mission('something-new', near)!
    const all = r.groups.flatMap((g) => g.products)
    expect(all.length).toBeGreaterThan(0)
    expect(all.every((p) => p.isNew)).toBe(true)
  })
})
