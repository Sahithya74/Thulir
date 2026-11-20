import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_STAGES,
  OWNER_BUCKET_ORDER,
  STORE_ORDER_TRANSITIONS,
  TERMINAL,
  bucketsFor,
  buildDemoCatalog,
  canTransition,
  createCatalogService,
  demoStores,
  evaluateEligibility,
  isTerminal,
  nextSteps,
  type Batch,
  type Product,
  type StoreOrderStatus,
} from './index.ts'

describe('order state machine', () => {
  const all = Object.keys(STORE_ORDER_TRANSITIONS) as StoreOrderStatus[]

  it('the happy path is exactly placed → accepted → preparing → ready → handed over → out for delivery → delivered', () => {
    expect(CUSTOMER_STAGES).toEqual(['placed', 'accepted', 'preparing', 'ready', 'handed_over', 'out_for_delivery', 'delivered'])
    for (let i = 0; i < CUSTOMER_STAGES.length - 1; i++) {
      const [from, to] = [CUSTOMER_STAGES[i], CUSTOMER_STAGES[i + 1]]
      expect(STORE_ORDER_TRANSITIONS[from].some((s) => s.to === to)).toBe(true)
    }
  })

  it('stores drive the kitchen steps, delivery partners drive the road steps, never the other way round', () => {
    for (const s of ['accepted', 'preparing', 'ready', 'handed_over'] as const) expect(canTransition(prev(s), s, 'store')).toBe(true)
    expect(canTransition('handed_over', 'out_for_delivery', 'delivery')).toBe(true)
    expect(canTransition('out_for_delivery', 'delivered', 'delivery')).toBe(true)
    expect(canTransition('handed_over', 'out_for_delivery', 'store')).toBe(false)
    expect(canTransition('preparing', 'ready', 'delivery')).toBe(false)
    expect(canTransition('out_for_delivery', 'delivered', 'customer')).toBe(false)
  })

  it('steps cannot be skipped or reversed', () => {
    expect(canTransition('placed', 'preparing', 'store')).toBe(false)
    expect(canTransition('placed', 'delivered', 'store')).toBe(false)
    expect(canTransition('ready', 'accepted', 'store')).toBe(false)
    expect(canTransition('accepted', 'placed', 'store')).toBe(false)
  })

  it('a store may reject only a new order', () => {
    expect(canTransition('placed', 'rejected', 'store')).toBe(true)
    for (const s of ['accepted', 'preparing', 'ready', 'handed_over', 'out_for_delivery'] as const) expect(canTransition(s, 'rejected', 'store')).toBe(false)
  })

  it('terminal states have no way out for anyone', () => {
    for (const t of TERMINAL) {
      expect(isTerminal(t)).toBe(true)
      for (const to of all) for (const a of ['customer', 'store', 'delivery', 'admin', 'system'] as const) expect(canTransition(t, to, a)).toBe(false)
    }
  })

  it('only the platform can cancel, and only before the order leaves the store', () => {
    for (const s of ['placed', 'accepted', 'preparing', 'ready'] as const) {
      expect(canTransition(s, 'cancelled', 'admin')).toBe(true)
      expect(canTransition(s, 'cancelled', 'store')).toBe(false)
      expect(canTransition(s, 'cancelled', 'customer')).toBe(false)
    }
    expect(canTransition('out_for_delivery', 'cancelled', 'admin')).toBe(false)
  })

  it('nextSteps lists what each portal may offer', () => {
    expect(nextSteps('placed', 'store').sort()).toEqual(['accepted', 'rejected'])
    expect(nextSteps('preparing', 'store')).toEqual(['ready'])
    expect(nextSteps('handed_over', 'store')).toEqual([])
    expect(nextSteps('handed_over', 'delivery')).toEqual(['out_for_delivery'])
  })

  function prev(s: StoreOrderStatus): StoreOrderStatus {
    return CUSTOMER_STAGES[CUSTOMER_STAGES.indexOf(s) - 1]
  }
})

const NOW = new Date('2026-06-10T06:30:00Z')
const day = (n: number) => new Date(Date.parse('2026-06-10T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
const product = (over: Partial<Product> = {}): Product => ({
  id: 'p', storeId: 's', department: 'pantry', name: { en: 'X', ta: '' }, brand: 'B', unit: '1 kg', pricePaise: 100, mrpPaise: 100,
  description: '', shape: 'box', color: '#c98255', tags: [], aliases: [], veg: true, requiresExpiry: true, available: true, flaggedForRemoval: false, ...over,
})
const batch = (qty: number, expiryDate: string | null, over: Partial<Batch> = {}): Batch => ({ id: `b${Math.random()}`, productId: 'p', batchNo: 'N', qty, expiryDate, status: 'active', ...over })
const buckets = (p: Product, bs: Batch[]) => bucketsFor(evaluateEligibility({ product: p, batches: bs, now: NOW }))

describe('owner worklist buckets', () => {
  it('priority order is expired → today → soon → review → invalid → blocked', () => {
    expect(OWNER_BUCKET_ORDER).toEqual(['expired', 'expires_today', 'expiring_soon', 'needs_review', 'invalid_expiry', 'blocked'])
  })
  it('healthy stock is in no worklist', () => {
    expect(buckets(product(), [batch(50, day(200))])).toEqual([])
  })
  it.each([
    ['expired batch', [batch(5, day(-2))], ['expired']],
    ['expires today', [batch(5, day(0))], ['expires_today']],
    ['near expiry (sellable)', [batch(5, day(10))], ['expiring_soon']],
    ['invalid date', [batch(5, 'garbage')], ['needs_review', 'invalid_expiry']],
    ['missing date', [batch(5, null)], ['needs_review', 'invalid_expiry']],
    ['blocked batch only', [batch(5, day(100), { status: 'blocked' })], ['blocked']],
  ])('%s', (_n, bs, want) => {
    expect(buckets(product(), bs as Batch[])).toEqual(want)
  })
  it('several problems at once: a product can sit in several worklists, in priority order', () => {
    // the near-expiry batch still sells, so the bad date is an "invalid" item to fix, not a product-level review
    expect(buckets(product(), [batch(5, day(-1)), batch(5, day(10)), batch(2, 'x')])).toEqual(['expired', 'expiring_soon', 'invalid_expiry'])
  })
  it('owner switches show as blocked', () => {
    expect(buckets(product({ available: false }), [batch(5, day(200))])).toEqual(['blocked'])
    expect(buckets(product({ flaggedForRemoval: true }), [batch(5, day(200))])).toEqual(['blocked'])
  })
  it('near-expiry that the policy will not sell is a review item, not just a warning', () => {
    const p = product({ policyOverride: { sellNearExpiry: false } })
    expect(buckets(p, [batch(5, day(5))])).toEqual(['expiring_soon', 'needs_review'])
  })
})

describe('policy overrides flow through the engine', () => {
  const stores = demoStores
  const data = buildDemoCatalog(NOW)
  const bhujia = data.products.find((p) => p.name.en === 'Aloo Bhujia')! // snacks, one batch ~4 days out

  it('a stricter store policy turns sellable stock into a blocked-from-sale review item', () => {
    const base = createCatalogService(stores, NOW, data)
    expect(base.verdicts().find((v) => v.product.id === bhujia.id)!.eligibility.sellable).toBe(true)
    const strict = createCatalogService(stores, NOW, data, (id) => (id === bhujia.storeId ? { department: { snacks: { sellNearExpiry: false } } } : {}))
    const v = strict.verdicts().find((x) => x.product.id === bhujia.id)!
    expect(v.eligibility.sellable).toBe(false)
    expect(v.eligibility.status).toBe('requires_review')
    expect(strict.product(bhujia.id)).toBeNull() // hidden from customers too
  })

  it('a lower near-expiry window makes the same stock plain eligible', () => {
    const lenient = createCatalogService(stores, NOW, data, () => ({ department: { snacks: { nearExpiryDays: 1 } } }))
    expect(lenient.verdicts().find((x) => x.product.id === bhujia.id)!.eligibility.status).not.toBe('near_expiry')
  })

  it('overrides apply to stock allocation as well, not only to what is displayed', () => {
    const strict = createCatalogService(stores, NOW, data, () => ({ department: { snacks: { sellNearExpiry: false } } }))
    expect(strict.allocate(bhujia.id, 1)).toBeNull()
    expect(createCatalogService(stores, NOW, data).allocate(bhujia.id, 1)).not.toBeNull()
  })

  it('one store\'s policy never leaks into another store', () => {
    const only = createCatalogService(stores, NOW, data, (id) => (id === 'store-illam' ? { department: { snacks: { sellNearExpiry: false } } } : {}))
    expect(only.verdicts().find((x) => x.product.id === bhujia.id)!.eligibility.sellable).toBe(true)
  })

  it('policyFor reports the policy actually applied', () => {
    const s = createCatalogService(stores, NOW, data, () => ({ department: { snacks: { nearExpiryDays: 3 } } }))
    expect(s.policyFor(bhujia).nearExpiryDays).toBe(3)
  })
})
