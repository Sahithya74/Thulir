import { describe, expect, it } from 'vitest'
import { demoStores, demoTowns, withDeliveryAll, type StoreWithDelivery } from '@thulir/shared'
import { filterStores, type StoreFilter } from './filter'

const none: StoreFilter = { query: '', categories: [], openNow: false, fast: false, offers: false, nearby: false }
const here = demoTowns[0].areas[0].geo // Market Road
const stores: StoreWithDelivery[] = withDeliveryAll(demoStores, here)
const noon = new Date('2026-01-01T06:30:00Z') // 12:00 IST — every store except none is open at noon
const night = new Date('2026-01-01T17:30:00Z') // 23:00 IST — everything closed

const ids = (f: Partial<StoreFilter>, now = noon) => filterStores(stores, { ...none, ...f }, now).map((s) => s.id)

describe('store filters', () => {
  it('returns every store with no filters, nearest deliverable first', () => {
    const out = filterStores(stores, none, noon)
    expect(out).toHaveLength(6)
    const dist = out.map((s) => s.delivery.distanceM)
    expect(dist).toEqual([...dist].sort((a, b) => a - b))
  })
  it('category filter is an OR across selected categories', () => {
    expect(ids({ categories: ['bakery'] })).toEqual(['store-madhuram'])
    expect(ids({ categories: ['bakery', 'dairy'] }).sort()).toEqual(['store-madhuram', 'store-thenral'])
  })
  it('text search matches English and Tamil, ignoring case', () => {
    expect(ids({ query: 'BAKERY' })).toContain('store-madhuram')
    expect(ids({ query: 'பால்' })).toContain('store-thenral')
    expect(ids({ query: 'zzzz' })).toEqual([])
  })
  it('open-now respects IST opening hours', () => {
    expect(ids({ openNow: true }, night)).toEqual([])
    expect(ids({ openNow: true }, noon)).toHaveLength(6)
  })
  it('offers only returns stores that have one', () => {
    const out = ids({ offers: true })
    expect(out.length).toBeGreaterThan(0)
    for (const id of out) expect(stores.find((s) => s.id === id)!.offers.length).toBeGreaterThan(0)
  })
  it('undeliverable stores sort last but are still listed', () => {
    const far = withDeliveryAll(demoStores, demoTowns[0].areas.find((a) => a.id === 'area-a-outer')!.geo)
    const out = filterStores(far, none, noon)
    expect(out).toHaveLength(6)
    expect(out[0].delivery.deliverable).toBe(true)
    expect(out.slice(1).every((s) => !s.delivery.deliverable)).toBe(true)
  })
})
