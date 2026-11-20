import { describe, expect, it } from 'vitest'
import {
  checkPincode,
  demoStores,
  demoTowns,
  deliveryFor,
  findArea,
  haversineM,
  isOpenAt,
  istDate,
  locationFromAddress,
  locationFromArea,
  metresFrom,
  offsetPoint,
  resolveDetectedPosition,
  withDeliveryAll,
} from './index.ts'

const town = demoTowns[0]
const area = (id: string) => findArea(demoTowns, id)!
const store = (id: string) => demoStores.find((s) => s.id === id)!

describe('geo', () => {
  it('haversine is ~0 for the same point and symmetric', () => {
    const a = town.center
    const b = offsetPoint(a, 1000, 0)
    expect(haversineM(a, a)).toBe(0)
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 3)
  })
  it('offsetPoint and metresFrom round-trip', () => {
    const p = offsetPoint(town.center, 1234, -567)
    const m = metresFrom(town.center, p)
    expect(m.east).toBeCloseTo(1234, 0)
    expect(m.north).toBeCloseTo(-567, 0)
    expect(haversineM(town.center, p)).toBeCloseTo(Math.hypot(1234, 567), -1)
  })
})

describe('delivery rules', () => {
  it('nearby area: every store reachable, ETA rounded up to 5 min and above prep time', () => {
    const list = withDeliveryAll(demoStores, area('area-a-market').geo)
    for (const s of list) {
      expect(s.delivery.deliverable).toBe(true)
      expect(s.delivery.etaMin % 5).toBe(0)
      expect(s.delivery.etaMin).toBeGreaterThanOrEqual(s.prepMin)
    }
  })
  it('far outer area: only stores with a wide radius deliver', () => {
    const list = withDeliveryAll(demoStores, area('area-a-outer').geo)
    const ids = list.filter((s) => s.delivery.deliverable).map((s) => s.id)
    expect(ids).toEqual(['store-marutham'])
  })
  it('radius boundary is inclusive', () => {
    const s = store('store-selvam')
    const edge = offsetPoint(s.geo, s.deliveryRadiusM - 5, 0)
    expect(deliveryFor(s, edge).deliverable).toBe(true)
    const beyond = offsetPoint(s.geo, s.deliveryRadiusM + 50, 0)
    expect(deliveryFor(s, beyond).deliverable).toBe(false)
  })
  it('further away never means faster', () => {
    const s = store('store-selvam')
    const near = deliveryFor(s, offsetPoint(s.geo, 300, 0))
    const far = deliveryFor(s, offsetPoint(s.geo, 2000, 0))
    expect(far.etaMin).toBeGreaterThanOrEqual(near.etaMin)
  })
})

describe('location resolution', () => {
  it('detected position inside the town maps to the nearest area', () => {
    const p = offsetPoint(area('area-a-railway').geo, 50, 50)
    const res = resolveDetectedPosition(demoTowns, p)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.location.areaId).toBe('area-a-railway')
      expect(res.location.source).toBe('detected')
      expect(res.location.geo).toEqual(p)
    }
  })
  it('a position far from every demo town is rejected, not silently snapped', () => {
    const res = resolveDetectedPosition(demoTowns, { lat: 13.08, lng: 80.27 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.distanceM).toBeGreaterThan(100_000)
  })
  it('locationFromArea carries the area geo and label', () => {
    const a = area('area-a-busstand')
    const loc = locationFromArea(a)
    expect(loc.geo).toEqual(a.geo)
    expect(loc.label.en).toBe('Bus Stand Area')
  })
  it('locationFromAddress needs a known area', () => {
    const ok = locationFromAddress({ id: 'x', label: 'home', line1: '12, Temple St', areaId: 'area-a-market', townId: town.id, pincode: '600991' }, demoTowns)
    expect(ok?.addressId).toBe('x')
    expect(ok?.label.en).toContain('12, Temple St')
    const bad = locationFromAddress({ id: 'y', label: 'home', line1: 'x', areaId: 'nope', townId: town.id, pincode: '600991' }, demoTowns)
    expect(bad).toBeNull()
  })
})

describe('pincode', () => {
  it('rejects malformed values', () => {
    for (const p of ['', '12345', '1234567', 'abcdef', '012345', '9' + '0'.repeat(5)]) {
      expect(checkPincode(town, p)).toBe('invalid_format')
    }
  })
  it('accepts sample pincodes and refuses others', () => {
    expect(checkPincode(town, '600991')).toBe('ok')
    expect(checkPincode(town, '600500')).toBe('not_serviceable')
  })
})

describe('opening hours (IST)', () => {
  // 2026-01-01T00:00Z is 05:30 IST
  const at = (iso: string) => new Date(iso)
  it('is open inside the window and closed outside', () => {
    const hours = { opens: '07:00', closes: '22:00' }
    expect(isOpenAt(hours, at('2026-01-01T00:00:00Z'))).toBe(false) // 05:30 IST
    expect(isOpenAt(hours, at('2026-01-01T02:00:00Z'))).toBe(true) // 07:30 IST
    expect(isOpenAt(hours, at('2026-01-01T16:30:00Z'))).toBe(false) // 22:00 IST exactly = closed
  })
  it('handles ranges that cross midnight', () => {
    const hours = { opens: '20:00', closes: '02:00' }
    expect(isOpenAt(hours, at('2026-01-01T17:00:00Z'))).toBe(true) // 22:30 IST
    expect(isOpenAt(hours, at('2026-01-01T07:00:00Z'))).toBe(false) // 12:30 IST
  })
  it('istDate rolls over at IST midnight, not UTC midnight', () => {
    expect(istDate(at('2026-01-01T18:29:00Z'))).toBe('2026-01-01') // 23:59 IST
    expect(istDate(at('2026-01-01T18:31:00Z'))).toBe('2026-01-02') // 00:01 IST next day
  })
})
