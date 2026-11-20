import { describe, expect, it } from 'vitest'
import {
  canPurchase,
  evaluateEligibility,
  isVisibleToCustomer,
  resolvePolicy,
  toCustomerEligibility,
  type Batch,
  type Product,
} from './index.ts'

// 2026-06-10 12:00 IST
const NOW = new Date('2026-06-10T06:30:00Z')
const day = (n: number) => new Date(Date.parse('2026-06-10T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1',
  storeId: 's1',
  department: 'pantry',
  name: { en: 'Test Dal', ta: '' },
  brand: 'Brand',
  unit: '500 g',
  pricePaise: 8500,
  mrpPaise: 9500,
  description: '',
  shape: 'pouch',
  color: '#c98255',
  tags: [],
  aliases: [],
  veg: true,
  requiresExpiry: true,
  available: true,
  flaggedForRemoval: false,
  ...over,
})
const batch = (qty: number, expiryDate: string | null, over: Partial<Batch> = {}): Batch => ({
  id: `b-${Math.random()}`,
  productId: 'p1',
  batchNo: 'B1',
  qty,
  expiryDate,
  status: 'active',
  ...over,
})
const run = (p: Product, bs: Batch[]) => evaluateEligibility({ product: p, batches: bs, now: NOW })

describe('expiry boundaries (pantry: near = 30 days)', () => {
  it('yesterday is expired and blocked', () => {
    const e = run(product(), [batch(10, day(-1))])
    expect(e.status).toBe('expired')
    expect(e.sellable).toBe(false)
    expect(e.sellableQty).toBe(0)
  })
  it('expiring TODAY is blocked from sale', () => {
    const e = run(product(), [batch(10, day(0))])
    expect(e.status).toBe('expired')
    expect(e.sellable).toBe(false)
    expect(e.reasons).toContain('EXPIRES_TODAY')
  })
  it('tomorrow is sellable but near expiry', () => {
    const e = run(product(), [batch(10, day(1))])
    expect(e.status).toBe('near_expiry')
    expect(e.sellable).toBe(true)
    expect(e.reasons).toContain('NEAR_EXPIRY')
    expect(e.needsOwnerAction).toBe(true)
  })
  it('exactly nearExpiryDays out is near; one day beyond is plain eligible', () => {
    expect(run(product(), [batch(10, day(30))]).status).toBe('near_expiry')
    expect(run(product(), [batch(10, day(31))]).status).toBe('eligible')
  })
  it('valid stock is eligible with no owner action', () => {
    const e = run(product(), [batch(40, day(200))])
    expect(e.status).toBe('eligible')
    expect(e.needsOwnerAction).toBe(false)
    expect(e.bestBefore).toBe(day(200))
  })
})

describe('IST day boundary', () => {
  it('at 00:01 IST the next calendar day, yesterday\'s expiry is already expired', () => {
    const justAfterMidnightIst = new Date('2026-06-10T18:31:00Z') // 2026-06-11 00:01 IST
    const e = evaluateEligibility({ product: product(), batches: [batch(5, '2026-06-10')], now: justAfterMidnightIst })
    expect(e.status).toBe('expired')
  })
  it('at 23:59 IST the same expiry date is "today" (blocked), not yet "yesterday"', () => {
    const lateIst = new Date('2026-06-10T18:29:00Z') // 2026-06-10 23:59 IST
    const e = evaluateEligibility({ product: product(), batches: [batch(5, '2026-06-10')], now: lateIst })
    expect(e.reasons).toContain('EXPIRES_TODAY')
    expect(e.sellable).toBe(false)
  })
})

describe('invalid expiry data is never sellable', () => {
  it.each([null, '', 'soon', '2026-02-30', '10/06/2026', '2026-6-1'])('rejects %j', (bad) => {
    const e = run(product(), [batch(10, bad as string | null)])
    expect(e.sellable).toBe(false)
    expect(e.status).toBe('requires_review')
  })
  it('an invalid batch beside a valid one is excluded but flagged', () => {
    const e = run(product(), [batch(8, day(200)), batch(5, 'garbage')])
    expect(e.status).toBe('eligible')
    expect(e.sellableQty).toBe(8)
    expect(e.reasons).toContain('INVALID_EXPIRY')
    expect(e.needsOwnerAction).toBe(true)
  })
  it('products that carry no expiry ignore expiry data entirely', () => {
    const p = product({ requiresExpiry: false, department: 'household' })
    expect(run(p, [batch(10, null)]).status).toBe('eligible')
    expect(run(p, [batch(10, 'garbage')]).status).toBe('eligible')
  })
})

describe('multiple batches', () => {
  it('expired batch is excluded from sellable stock, valid one counts', () => {
    const e = run(product(), [batch(10, day(-3)), batch(7, day(100))])
    expect(e.sellableQty).toBe(7)
    expect(e.totalQty).toBe(17)
    expect(e.status).toBe('eligible')
    expect(e.reasons).toContain('EXPIRED_BATCH')
  })
  it('best-before is the earliest SELLABLE expiry (first-expiry-first-out)', () => {
    const e = run(product(), [batch(5, day(120)), batch(5, day(60)), batch(5, day(-2))])
    expect(e.bestBefore).toBe(day(60))
  })
  it('status follows the earliest sellable batch: a near batch makes the product near_expiry', () => {
    const e = run(product(), [batch(20, day(200)), batch(10, day(10))])
    expect(e.status).toBe('near_expiry')
    expect(e.sellableQty).toBe(30)
  })
  it('blocked and removed batches never count', () => {
    const e = run(product(), [batch(50, day(200), { status: 'blocked' }), batch(3, day(200), { status: 'removed' })])
    expect(e.sellableQty).toBe(0)
    expect(e.status).toBe('blocked')
  })
})

describe('stock and owner switches', () => {
  it('zero stock is out_of_stock (visible, greyed)', () => {
    const e = run(product(), [batch(0, day(100))])
    expect(e.status).toBe('out_of_stock')
    expect(isVisibleToCustomer(e)).toBe(true)
  })
  it('no batches at all is out_of_stock with NO_BATCHES', () => {
    const e = run(product(), [])
    expect(e.status).toBe('out_of_stock')
    expect(e.reasons).toContain('NO_BATCHES')
  })
  it('low stock threshold is inclusive', () => {
    expect(run(product(), [batch(5, day(200))]).status).toBe('low_stock')
    expect(run(product(), [batch(6, day(200))]).status).toBe('eligible')
  })
  it('unavailable and flagged products are blocked even with plenty of valid stock', () => {
    expect(run(product({ available: false }), [batch(99, day(200))]).status).toBe('blocked')
    const flagged = run(product({ flaggedForRemoval: true }), [batch(99, day(200))])
    expect(flagged.status).toBe('blocked')
    expect(flagged.sellable).toBe(false)
  })
})

describe('configurable policies', () => {
  it('department defaults differ: bread near = 1 day, rice near = 30 days', () => {
    expect(resolvePolicy(product({ department: 'bakery' })).nearExpiryDays).toBe(1)
    expect(resolvePolicy(product({ department: 'pantry' })).nearExpiryDays).toBe(30)
  })
  it('precedence: product beats store beats department beats platform', () => {
    const p = product({ policyOverride: { nearExpiryDays: 3 } })
    const pol = resolvePolicy(p, { store: { nearExpiryDays: 9 }, department: { pantry: { nearExpiryDays: 20 } } })
    expect(pol.nearExpiryDays).toBe(3)
    expect(resolvePolicy(product(), { store: { nearExpiryDays: 9 }, department: { pantry: { nearExpiryDays: 20 } } }).nearExpiryDays).toBe(9)
  })
  it('sellNearExpiry=false turns near stock into a review item that cannot be sold', () => {
    const p = product({ policyOverride: { sellNearExpiry: false } })
    const e = run(p, [batch(10, day(5))])
    expect(e.sellable).toBe(false)
    expect(e.status).toBe('requires_review')
    expect(e.reasons).toContain('NEAR_EXPIRY_NOT_SOLD')
  })
  it('blockOnExpiryDay=false lets expiry-day stock through as near expiry', () => {
    const p = product({ policyOverride: { blockOnExpiryDay: false } })
    const e = run(p, [batch(10, day(0))])
    expect(e.sellable).toBe(true)
    expect(e.status).toBe('near_expiry')
  })
})

describe('purchase gate and customer projection', () => {
  it('canPurchase rejects ineligible, zero, fractional and over-stock quantities', () => {
    const ok = run(product(), [batch(4, day(200))])
    expect(canPurchase(ok, 1)).toBe(true)
    expect(canPurchase(ok, 4)).toBe(true)
    expect(canPurchase(ok, 5)).toBe(false)
    expect(canPurchase(ok, 0)).toBe(false)
    expect(canPurchase(ok, 1.5)).toBe(false)
    expect(canPurchase(run(product(), [batch(9, day(-1))]), 1)).toBe(false)
  })
  it('hidden statuses are not visible to customers', () => {
    for (const bs of [[batch(5, day(-1))], [batch(5, 'x')], [batch(5, day(100), { status: 'blocked' })]]) {
      expect(isVisibleToCustomer(run(product(), bs))).toBe(false)
    }
  })
  it('customer projection never leaks internal reasons', () => {
    const c = toCustomerEligibility(run(product(), [batch(10, day(5)), batch(3, 'bad')]))
    expect(Object.keys(c).sort()).toEqual(['bestBefore', 'daysToExpiry', 'sellable', 'sellableQty', 'status'])
    expect(c.status).toBe('near_expiry')
  })
})
