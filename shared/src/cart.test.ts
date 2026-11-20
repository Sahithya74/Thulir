import { describe, expect, it } from 'vitest'
import {
  MAX_LINE_QTY,
  buildDemoCatalog,
  createCatalogService,
  demoStores,
  demoTowns,
  withDeliveryAll,
  type CartLineInput,
} from './index.ts'

const NOW = new Date('2026-06-10T06:30:00Z') // 12:00 IST
const data = buildDemoCatalog(NOW)
const svc = createCatalogService(demoStores, NOW, data)
const area = (id: string) => demoTowns[0].areas.find((a) => a.id === id)!.geo
const near = withDeliveryAll(demoStores, area('area-a-market'))
const far = withDeliveryAll(demoStores, area('area-a-outer')) // only the supermarket delivers here

/** Look a product up by store + English name so the tests do not depend on id numbering. */
const id = (storeId: string, name: string) => {
  const p = data.products.find((x) => x.storeId === storeId && x.name.en === name)
  if (!p) throw new Error(`no product ${name} in ${storeId}`)
  return p.id
}
const cart = (lines: CartLineInput[], stores = near) => svc.cart(lines, stores)
const group = (c: ReturnType<typeof cart>, storeId: string) => c.groups.find((g) => g.store.id === storeId)!

describe('pricing (integer paise)', () => {
  it('a plain line is price × qty with no discount and no tax', () => {
    const c = cart([{ productId: id('store-selvam', 'Toor Dal'), qty: 1 }]) // ₹88
    const g = group(c, 'store-selvam')
    expect(g.subtotalPaise).toBe(8800)
    expect(g.offerDiscountPaise).toBe(0)
    expect(g.taxPaise).toBe(0)
    expect(g.mrpSavingsPaise).toBe(700) // MRP ₹95
  })

  it('delivery is charged below the free-delivery threshold and reports how much more to spend', () => {
    const g = group(cart([{ productId: id('store-selvam', 'Toor Dal'), qty: 1 }]), 'store-selvam')
    expect(g.deliveryFeePaise).toBe(2500)
    expect(g.freeDeliveryRemainingPaise).toBe(39900 - 8800)
    expect(g.totalPaise).toBe(8800 + 2500)
  })

  it('delivery is free once the threshold is reached (inclusive)', () => {
    const g = group(cart([{ productId: id('store-selvam', 'Sesame (Gingelly) Oil'), qty: 2 }]), 'store-selvam') // ₹570
    expect(g.deliveryFeePaise).toBe(0)
    expect(g.freeDeliveryRemainingPaise).toBeNull()
    expect(g.totalPaise).toBe(57000)
  })

  it('percent offer applies only to qualifying items (10% off "staple" at the supermarket)', () => {
    const atta = id('store-marutham', 'Whole Wheat Atta') // ₹265, tagged staple
    const noodles = id('store-marutham', 'Masala Noodles 4-pack') // ₹56, not staple
    const g = group(cart([{ productId: atta, qty: 2 }, { productId: noodles, qty: 1 }]), 'store-marutham')
    expect(g.appliedOffers).toHaveLength(1)
    expect(g.offerDiscountPaise).toBe(5300) // 10% of ₹530 only
    expect(g.subtotalPaise).toBe(53000 + 5600)
  })

  it('percent discount rounds down to whole paise', () => {
    const g = group(cart([{ productId: id('store-marutham', 'Sugar'), qty: 1 }]), 'store-marutham') // ₹47 staple
    expect(g.offerDiscountPaise).toBe(Math.floor((4700 * 10) / 100))
    expect(Number.isInteger(g.totalPaise)).toBe(true)
  })

  it('flat offer needs its minimum subtotal', () => {
    const below = group(cart([{ productId: id('store-madhuram', 'Plum Cake'), qty: 2 }]), 'store-madhuram') // ₹240
    expect(below.offerDiscountPaise).toBe(0)
    const above = group(cart([{ productId: id('store-madhuram', 'Chocolate Cake'), qty: 1 }]), 'store-madhuram') // ₹380
    expect(above.offerDiscountPaise).toBe(3000)
  })

  it('the discounted subtotal (not the raw one) decides free delivery', () => {
    // ₹380 − ₹30 = ₹350 ≥ ₹349 threshold → free
    const g = group(cart([{ productId: id('store-madhuram', 'Chocolate Cake'), qty: 1 }]), 'store-madhuram')
    expect(g.deliveryFeePaise).toBe(0)
    expect(g.totalPaise).toBe(35000)
  })

  it('department-scoped percent offer (5% personal care) ignores other departments', () => {
    const soap = id('store-illam', 'Soap 4-pack') // personal care ₹140
    const scrub = id('store-illam', 'Scrub Pad') // household ₹40
    const g = group(cart([{ productId: soap, qty: 1 }, { productId: scrub, qty: 1 }]), 'store-illam')
    expect(g.offerDiscountPaise).toBe(700)
  })

  it('order totals are the sum of the store totals', () => {
    const c = cart([
      { productId: id('store-selvam', 'Toor Dal'), qty: 2 },
      { productId: id('store-madhuram', 'Milk Bread'), qty: 1 },
    ])
    expect(c.totalPaise).toBe(c.groups.reduce((n, g) => n + g.totalPaise, 0))
    expect(c.deliveryPaise).toBe(c.groups.reduce((n, g) => n + g.deliveryFeePaise, 0))
    expect(c.subtotalPaise - c.discountPaise + c.deliveryPaise).toBe(c.totalPaise)
  })
})

describe('multi-store baskets', () => {
  it('are split per store, nearest first, and flagged as several deliveries', () => {
    const c = cart([
      { productId: id('store-madhuram', 'Milk Bread'), qty: 1 },
      { productId: id('store-selvam', 'Toor Dal'), qty: 1 },
    ])
    expect(c.groups).toHaveLength(2)
    expect(c.multiDelivery).toBe(true)
    const d = c.groups.map((g) => g.store.distanceM)
    expect(d).toEqual([...d].sort((a, b) => a - b))
    for (const g of c.groups) expect(g.store.etaMin).toBeGreaterThan(0)
  })
  it('one store is a single delivery', () => {
    expect(cart([{ productId: id('store-selvam', 'Toor Dal'), qty: 1 }]).multiDelivery).toBe(false)
  })
  it('delivery fees are per store (not shared)', () => {
    const c = cart([
      { productId: id('store-madhuram', 'Milk Bread'), qty: 1 },
      { productId: id('store-selvam', 'Toor Dal'), qty: 1 },
    ])
    expect(c.deliveryPaise).toBe(3000 + 2500)
  })
  it('the same product listed twice is merged into one line', () => {
    const p = id('store-selvam', 'Toor Dal')
    const c = cart([{ productId: p, qty: 1 }, { productId: p, qty: 2 }])
    expect(group(c, 'store-selvam').lines).toHaveLength(1)
    expect(group(c, 'store-selvam').lines[0].qty).toBe(3)
  })
})

describe('validation: every way a line can stop being buyable', () => {
  it('a clean basket can check out', () => {
    const c = cart([{ productId: id('store-selvam', 'Toor Dal'), qty: 2 }])
    expect(c.canCheckout).toBe(true)
    expect(c.issues).toEqual([])
  })

  it('an empty basket cannot', () => {
    expect(cart([]).canCheckout).toBe(false)
  })

  it('quantity above stock is reduced to what is available', () => {
    const chips = id('store-marutham', "Classic Salted Chips") // 3 in stock
    const c = cart([{ productId: chips, qty: 10 }])
    const line = group(c, 'store-marutham').lines[0]
    expect(line.status).toBe('adjusted')
    expect(line.qty).toBe(3)
    expect(line.issue).toBe('QTY_REDUCED')
    expect(c.canCheckout).toBe(false) // must be re-confirmed after the change
    expect(c.issues[0]).toMatchObject({ requestedQty: 10, allowedQty: 3 })
  })

  it('sold-out items are removed as OUT_OF_STOCK', () => {
    const batter = id('store-marutham', 'Idli Dosa Batter')
    const line = group(cart([{ productId: batter, qty: 1 }]), 'store-marutham').lines[0]
    expect(line.status).toBe('removed')
    expect(line.issue).toBe('OUT_OF_STOCK')
    expect(line.lineTotalPaise).toBe(0)
  })

  it.each([
    ['expires today', 'store-marutham', 'Tender Coconut Water'],
    ['flagged for removal', 'store-marutham', 'Spicy Murukku'],
    ['switched off by the owner', 'store-marutham', 'Cold Coffee Can'],
    ['expired batch only', 'store-thenral', 'Flavoured Milk'],
    ['invalid expiry date', 'store-selvam', 'Fennel Seeds'],
  ])('%s is removed as UNAVAILABLE without revealing why', (_why, storeId, name) => {
    const c = cart([{ productId: id(storeId, name), qty: 1 }])
    const line = group(c, storeId).lines[0]
    expect(line.status).toBe('removed')
    expect(line.issue).toBe('UNAVAILABLE')
    expect(c.canCheckout).toBe(false)
    expect(JSON.stringify(c)).not.toMatch(/expire|flagged|invalid|owner/i)
  })

  it('removed lines never contribute to totals', () => {
    const c = cart([
      { productId: id('store-selvam', 'Toor Dal'), qty: 1 },
      { productId: id('store-selvam', 'Fennel Seeds'), qty: 5 },
    ])
    expect(group(c, 'store-selvam').subtotalPaise).toBe(8800)
    expect(group(c, 'store-selvam').itemCount).toBe(1)
  })

  it('a store that does not deliver to the customer removes its lines as NOT_DELIVERABLE', () => {
    const c = cart([{ productId: id('store-selvam', 'Toor Dal'), qty: 1 }], far)
    expect(group(c, 'store-selvam').lines[0].issue).toBe('NOT_DELIVERABLE')
    expect(c.canCheckout).toBe(false)
    const ok = cart([{ productId: id('store-marutham', 'Whole Wheat Atta'), qty: 1 }], far)
    expect(ok.canCheckout).toBe(true)
  })

  it.each([0, -3, 1.5, NaN, Infinity, MAX_LINE_QTY + 1, 1e9])('quantity %s is rejected as INVALID_QTY', (qty) => {
    const c = cart([{ productId: id('store-selvam', 'Toor Dal'), qty }])
    expect(c.canCheckout).toBe(false)
    expect(c.issues[0].issue).toBe('INVALID_QTY')
    expect(c.totalPaise).toBe(0)
  })

  it('unknown product ids are reported, not trusted', () => {
    const c = cart([{ productId: 'does-not-exist', qty: 1 }])
    expect(c.issues[0].issue).toBe('UNAVAILABLE')
    expect(c.groups).toEqual([])
    expect(c.canCheckout).toBe(false)
  })

  it('the caller cannot influence the price: only ids and quantities are read', () => {
    const p = id('store-selvam', 'Toor Dal')
    const tampered = [{ productId: p, qty: 1, pricePaise: 1, price: 0.01 } as unknown as CartLineInput]
    expect(group(cart(tampered), 'store-selvam').subtotalPaise).toBe(8800)
  })
})

describe('stock allocation (first-expiry-first-out)', () => {
  const toor = id('store-marutham', 'Toor Dal') // batches: 28 @ +120d, 20 @ +260d

  it('draws from the earliest-expiring batch first, then spills over', () => {
    const a = svc.allocate(toor, 30)!
    expect(a).toEqual([
      { batchId: `${toor}-b1`, qty: 28 },
      { batchId: `${toor}-b2`, qty: 2 },
    ])
    expect(a.reduce((n, x) => n + x.qty, 0)).toBe(30)
  })

  it('a small order takes only from the first batch', () => {
    expect(svc.allocate(toor, 5)).toEqual([{ batchId: `${toor}-b1`, qty: 5 }])
  })

  it('refuses when stock is insufficient (nothing partial)', () => {
    expect(svc.allocate(toor, 49)).toBeNull()
    expect(svc.allocate(toor, 48)).not.toBeNull()
  })

  it('never takes from an expired batch', () => {
    const juice = id('store-marutham', 'Mixed Fruit Juice') // 14 fresh + 10 expired
    expect(svc.allocate(juice, 14)).toEqual([{ batchId: `${juice}-b1`, qty: 14 }])
    expect(svc.allocate(juice, 15)).toBeNull()
  })

  it('refuses ineligible products and bad quantities', () => {
    expect(svc.allocate(id('store-marutham', 'Tender Coconut Water'), 1)).toBeNull()
    expect(svc.allocate(id('store-marutham', 'Spicy Murukku'), 1)).toBeNull()
    expect(svc.allocate(toor, 0)).toBeNull()
    expect(svc.allocate(toor, 1.5)).toBeNull()
    expect(svc.allocate('nope', 1)).toBeNull()
  })
})
