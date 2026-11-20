import { describe, expect, it } from 'vitest'
import { buildDemoCatalog, createCatalogService, demoStores } from '@thulir/shared'
import { DEFAULT_FILTER, applyProductFilter, brandsOf, type ProductFilter } from './productFilter'

const now = new Date('2026-06-10T06:30:00Z')
const svc = createCatalogService(demoStores, now, buildDemoCatalog(now))
const mm = svc.storeCatalog('store-marutham')!.products
const run = (f: Partial<ProductFilter>) => applyProductFilter(mm, { ...DEFAULT_FILTER, ...f })

describe('product filters', () => {
  it('no filters returns everything', () => {
    expect(run({})).toHaveLength(mm.length)
  })
  it('department narrows', () => {
    const out = run({ department: 'snacks' })
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((p) => p.department === 'snacks')).toBe(true)
  })
  it('brand narrows and brandsOf lists each brand once', () => {
    expect(run({ brand: 'Amul' }).every((p) => p.brand === 'Amul')).toBe(true)
    const b = brandsOf(mm)
    expect(new Set(b).size).toBe(b.length)
  })
  it('max price is inclusive', () => {
    const out = run({ maxPricePaise: 5000 })
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((p) => p.pricePaise <= 5000)).toBe(true)
    expect(run({ maxPricePaise: 4000 }).some((p) => p.pricePaise === 4000)).toBe(true)
  })
  it('on-offer keeps only discounted items', () => {
    expect(run({ onOffer: true }).every((p) => p.discountPercent > 0)).toBe(true)
  })
  it('veg-only drops non-vegetarian products', () => {
    const dairy = svc.storeCatalog('store-thenral')!.products
    const all = applyProductFilter(dairy, DEFAULT_FILTER)
    const veg = applyProductFilter(dairy, { ...DEFAULT_FILTER, vegOnly: true })
    expect(all.some((p) => !p.veg)).toBe(true) // eggs
    expect(veg.every((p) => p.veg)).toBe(true)
  })
  it('search matches English, Tamil and transliteration', () => {
    expect(run({ query: 'toor' }).map((p) => p.id)).toContain('mm-03')
    expect(run({ query: 'துவரம்' }).map((p) => p.id)).toContain('mm-03')
    expect(run({ query: 'paruppu' }).map((p) => p.id)).toContain('mm-03')
    expect(run({ query: 'zzzzz' })).toEqual([])
  })
  it('filters combine (AND)', () => {
    const out = run({ department: 'pantry', maxPricePaise: 10000, onOffer: true })
    expect(out.every((p) => p.department === 'pantry' && p.pricePaise <= 10000 && p.discountPercent > 0)).toBe(true)
  })
})

describe('sorting', () => {
  const prices = (f: Partial<ProductFilter>) => run(f).filter((p) => p.eligibility.sellable).map((p) => p.pricePaise)
  it('price low→high and high→low', () => {
    const lo = prices({ sort: 'priceLow' })
    const hi = prices({ sort: 'priceHigh' })
    expect(lo).toEqual([...lo].sort((a, b) => a - b))
    expect(hi).toEqual([...hi].sort((a, b) => b - a))
  })
  it('name sort is alphabetical', () => {
    const n = run({ sort: 'name' }).filter((p) => p.eligibility.sellable).map((p) => p.name.en)
    expect(n).toEqual([...n].sort((a, b) => a.localeCompare(b)))
  })
  it('biggest discount first', () => {
    const d = run({ sort: 'discount' }).filter((p) => p.eligibility.sellable).map((p) => p.discountPercent)
    expect(d).toEqual([...d].sort((a, b) => b - a))
  })
  it('sold-out items always come after sellable ones, whatever the sort', () => {
    for (const sort of ['relevance', 'priceLow', 'priceHigh', 'name', 'discount'] as const) {
      const out = run({ sort })
      const firstSoldOut = out.findIndex((p) => !p.eligibility.sellable)
      if (firstSoldOut >= 0) expect(out.slice(firstSoldOut).every((p) => !p.eligibility.sellable)).toBe(true)
    }
  })
  it('relevance ranks the best text match first', () => {
    const out = run({ query: 'salt' })
    expect(out[0].name.en).toMatch(/salt/i)
  })
})
