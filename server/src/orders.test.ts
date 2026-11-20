import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { buildDemoCatalog } from '@thulir/shared'
import { createApp, type AppOptions } from './app.js'

const START = new Date('2026-06-10T06:30:00Z') // 12:00 IST
const MARKET = { lat: 11.2, lng: 78.15 }
const OUTER = { lat: 11.2 + 2600 / 111320, lng: 78.15 + 3200 / (111320 * Math.cos((11.2 * Math.PI) / 180)) }
const data = buildDemoCatalog(START)
const pid = (storeId: string, name: string) => {
  const p = data.products.find((x) => x.storeId === storeId && x.name.en === name)
  if (!p) throw new Error(`no product ${name}`)
  return p.id
}

const TOOR = pid('store-selvam', 'Toor Dal') // ₹88
const SESAME = pid('store-selvam', 'Sesame (Gingelly) Oil') // ₹285
const BREAD = pid('store-madhuram', 'Milk Bread') // ₹42
const CHIPS = pid('store-marutham', 'Classic Salted Chips') // 3 in stock
const COCONUT_WATER = pid('store-marutham', 'Tender Coconut Water') // expires today -> hidden
const FENNEL = pid('store-selvam', 'Fennel Seeds') // invalid expiry -> hidden

const open: Server[] = []
afterEach(async () => {
  await Promise.all(open.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))))
})

async function boot(opts: { start?: Date; rateLimits?: AppOptions['rateLimits'] } = {}) {
  let now = opts.start ?? START
  const app = createApp({ clock: () => now, rateLimits: opts.rateLimits })
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  open.push(server)
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`

  const call = async (method: string, path: string, body?: unknown, token?: string) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { 'x-guest-token': token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, text, json: JSON.parse(text) as any, headers: res.headers }
  }
  const token = () => randomBytes(18).toString('base64url') // 24 chars
  const stock = async (productId: string) => {
    const r = await call('GET', `/products/${productId}`)
    return r.status === 200 ? (r.json.data.hit.product.eligibility.sellableQty as number) : null
  }
  const address = (over: Record<string, unknown> = {}) => ({
    name: 'Anitha Kumar',
    phone: '98765 43210',
    line1: '12, Temple Street',
    areaId: 'area-a-market',
    pincode: '600991',
    instructions: 'Ring the bell twice',
    ...over,
  })
  const order = (lines: { productId: string; qty: number }[], over: Record<string, unknown> = {}) => ({
    lines,
    address: address(),
    slot: { kind: 'asap' },
    paymentMethod: 'cod',
    idempotencyKey: randomBytes(12).toString('hex'),
    ...over,
  })
  return { base, call, token, stock, address, order, setNow: (d: Date) => (now = d), getNow: () => now }
}

describe('access and input validation', () => {
  it('requires a guest token, and rejects malformed ones', async () => {
    const c = await boot()
    for (const t of [undefined, 'short', 'has spaces and symbols !!!!!!!!!!!!!!', 'x'.repeat(80)]) {
      const r = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }]), t)
      expect(r.status).toBe(401)
      expect(r.json.error.code).toBe('GUEST_TOKEN_REQUIRED')
    }
  })

  it('rejects unknown fields outright — a client-supplied price never reaches the server logic', async () => {
    const c = await boot()
    const t = c.token()
    const withPrice = c.order([{ productId: TOOR, qty: 1, pricePaise: 1 } as never])
    expect((await c.call('POST', '/orders', withPrice, t)).status).toBe(400)
    expect((await c.call('POST', '/orders', { ...c.order([{ productId: TOOR, qty: 1 }]), totalPaise: 1 }, t)).status).toBe(400)
    expect((await c.call('POST', '/cart/validate', { lines: [{ productId: TOOR, qty: 1, price: 0 }], ...MARKET })).status).toBe(400)
  })

  it.each([
    ['name too short', { name: 'A' }],
    ['bad phone', { phone: '12345' }],
    ['phone with letters', { phone: '98765abcde' }],
    ['short street', { line1: 'ab' }],
    ['pincode not 6 digits', { pincode: '6009' }],
    ['instructions too long', { instructions: 'x'.repeat(201) }],
  ])('%s is a 400 with field details', async (_n, over) => {
    const c = await boot()
    const r = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }], { address: c.address(over) }), c.token())
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('VALIDATION_FAILED')
  })

  it('an unserviceable pincode or unknown area is refused before anything is reserved', async () => {
    const c = await boot()
    const t = c.token()
    const before = await c.stock(TOOR)
    const a = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }], { address: c.address({ pincode: '600500' }) }), t)
    expect(a.status).toBe(422)
    expect(a.json.error.code).toBe('PINCODE_NOT_SERVICEABLE')
    const b = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }], { address: c.address({ areaId: 'nowhere' }) }), t)
    expect(b.status).toBe(422)
    expect(await c.stock(TOOR)).toBe(before)
  })

  it('accepts Indian phone formats and stores the canonical 10 digits', async () => {
    const c = await boot()
    const r = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }], { address: c.address({ phone: '+91 98765-43210' }) }), c.token())
    expect(r.status).toBe(201)
    expect(r.json.data.address.phone).toBe('9876543210')
  })

  it('delivery slots: a valid window works, an unavailable one is refused', async () => {
    const c = await boot()
    const ok = await c.call('POST', '/orders', c.order([{ productId: BREAD, qty: 1 }], { slot: { kind: 'window', startHour: 14 } }), c.token())
    expect(ok.status).toBe(201)
    expect(ok.json.data.slotLabel).toBe('Today 14:00–15:00')
    const tooSoon = await c.call('POST', '/orders', c.order([{ productId: BREAD, qty: 1 }], { slot: { kind: 'window', startHour: 12 } }), c.token())
    expect(tooSoon.status).toBe(422)
    expect(tooSoon.json.error.code).toBe('SLOT_UNAVAILABLE')
  })
})

describe('cash on delivery: the happy path', () => {
  it('confirms immediately, prices on the server, and takes the stock', async () => {
    const c = await boot()
    const t = c.token()
    const before = await c.stock(TOOR)
    const r = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 2 }]), t)
    expect(r.status).toBe(201)
    const o = r.json.data
    expect(o.id).toMatch(/^TH-[0-9A-F]{8}$/)
    expect(o.status).toBe('confirmed')
    expect(o.payment).toMatchObject({ method: 'cod', status: 'cod_pending', simulated: false, amountPaise: o.totalPaise })
    expect(o.storeOrders).toHaveLength(1)
    expect(o.storeOrders[0].items[0]).toMatchObject({ productId: TOOR, qty: 2, pricePaise: 8800, lineTotalPaise: 17600 })
    expect(o.subtotalPaise).toBe(17600)
    expect(o.deliveryPaise).toBe(2500)
    expect(o.totalPaise).toBe(17600 + 2500)
    expect(await c.stock(TOOR)).toBe(before! - 2)
  })

  it('the order total equals what the basket validation said a moment earlier', async () => {
    const c = await boot()
    const lines = [{ productId: SESAME, qty: 2 }, { productId: BREAD, qty: 3 }]
    const v = await c.call('POST', '/cart/validate', { lines, ...MARKET })
    const o = await c.call('POST', '/orders', c.order(lines), c.token())
    expect(o.json.data.totalPaise).toBe(v.json.data.totalPaise)
    expect(o.json.data.multiDelivery).toBe(true)
    expect(o.json.data.storeOrders).toHaveLength(2)
  })

  it('never leaks stock allocations or batch details', async () => {
    const c = await boot()
    const r = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }]), c.token())
    for (const w of ['allocations', 'batchId', '-b1', 'ownerHash', 'fingerprint', 'idempotencyKey', 'providerRef']) expect(r.text).not.toContain(w)
  })

  it('a multi-store order is split per store with its own fee and ETA', async () => {
    const c = await boot()
    const r = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }, { productId: BREAD, qty: 1 }]), c.token())
    const so = r.json.data.storeOrders
    expect(so).toHaveLength(2)
    expect(so.map((s: { store: { slug: string } }) => s.store.slug).sort()).toEqual(['madhuram-bakery', 'selvam-provision-stores'])
    expect(so.reduce((n: number, s: { totalPaise: number }) => n + s.totalPaise, 0)).toBe(r.json.data.totalPaise)
    for (const s of so) {
      expect(s.etaMin).toBeGreaterThan(0)
      expect(s.status).toBe('placed')
    }
    expect(r.json.data.deliveryPaise).toBe(2500 + 3000)
  })
})

describe('the basket is re-validated at the gate (nothing is created when it has changed)', () => {
  it.each([
    ['expires today', COCONUT_WATER],
    ['invalid expiry date', FENNEL],
  ])('a product that is %s -> 409 CART_CHANGED, no stock taken, no order', async (_why, productId) => {
    const c = await boot()
    const t = c.token()
    const r = await c.call('POST', '/orders', c.order([{ productId, qty: 1 }, { productId: TOOR, qty: 1 }]), t)
    expect(r.status).toBe(409)
    expect(r.json.error.code).toBe('CART_CHANGED')
    expect(r.json.error.details.issues[0].issue).toBe('UNAVAILABLE')
    expect(JSON.stringify(r.json)).not.toMatch(/expire|invalid date/i)
    expect((await c.call('GET', '/orders', undefined, t)).json.data).toEqual([])
    expect(await c.stock(TOOR)).toBe(40)
  })

  it('more than the stock -> 409 with the allowed quantity, nothing reserved', async () => {
    const c = await boot()
    const t = c.token()
    const r = await c.call('POST', '/orders', c.order([{ productId: CHIPS, qty: 10 }]), t)
    expect(r.status).toBe(409)
    expect(r.json.error.details.issues[0]).toMatchObject({ issue: 'QTY_REDUCED', requestedQty: 10, allowedQty: 3 })
    expect(await c.stock(CHIPS)).toBe(3)
  })

  it.each([0, -1, 1.5, 21])('quantity %s is refused', async (qty) => {
    const c = await boot()
    const r = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty }]), c.token())
    expect(r.status).toBe(409)
    expect(r.json.error.details.issues[0].issue).toBe('INVALID_QTY')
  })

  it('a store that does not deliver to the customer blocks the order', async () => {
    const c = await boot()
    // the outer layouts are served from the same area id the client would send; use the real far area
    const far = await c.call('POST', '/cart/validate', { lines: [{ productId: TOOR, qty: 1 }], ...OUTER })
    expect(far.json.data.canCheckout).toBe(false)
    expect(far.json.data.issues[0].issue).toBe('NOT_DELIVERABLE')
    const r = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }], { address: c.address({ areaId: 'area-a-outer' }) }), c.token())
    expect(r.status).toBe(409)
    expect(r.json.error.details.issues[0].issue).toBe('NOT_DELIVERABLE')
  })
})

describe('stock is never oversold', () => {
  it('two simultaneous orders for the last units: exactly one wins', async () => {
    const c = await boot()
    const [a, b] = await Promise.all([
      c.call('POST', '/orders', c.order([{ productId: CHIPS, qty: 2 }]), c.token()),
      c.call('POST', '/orders', c.order([{ productId: CHIPS, qty: 2 }]), c.token()),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    expect(await c.stock(CHIPS)).toBe(1)
  })

  it('ten simultaneous orders for 3 units sell exactly 3', async () => {
    const c = await boot()
    const results = await Promise.all(Array.from({ length: 10 }, () => c.call('POST', '/orders', c.order([{ productId: CHIPS, qty: 1 }]), c.token())))
    expect(results.filter((r) => r.status === 201)).toHaveLength(3)
    expect(results.filter((r) => r.status === 409)).toHaveLength(7)
    // everything sold: the product is shown as sold out, not sellable
    const p = await c.call('GET', `/products/${CHIPS}`)
    expect(p.status === 404 || p.json.data.hit.product.eligibility.sellable === false).toBe(true)
  })

  it('stock keeps depleting across several orders and is never over-promised', async () => {
    const c = await boot()
    // Marutham Toor Dal is held in two batches (28 + 20 = 48). A line is capped at 20, so spill across batches takes
    // more than one order; the first-expiry-first-out drawing itself is unit-tested against the shared allocator.
    const toor = pid('store-marutham', 'Toor Dal')
    expect((await c.call('POST', '/orders', c.order([{ productId: toor, qty: 20 }]), c.token())).status).toBe(201)
    expect((await c.call('POST', '/orders', c.order([{ productId: toor, qty: 20 }]), c.token())).status).toBe(201)
    expect(await c.stock(toor)).toBe(8)
    expect((await c.call('POST', '/orders', c.order([{ productId: toor, qty: 9 }]), c.token())).status).toBe(409)
    expect((await c.call('POST', '/orders', c.order([{ productId: toor, qty: 8 }]), c.token())).status).toBe(201)
    expect((await c.call('GET', `/products/${toor}`)).json.data.hit.product.eligibility.sellable).toBe(false)
  })
})

describe('idempotency', () => {
  it('the same request key returns the same order and takes stock once', async () => {
    const c = await boot()
    const t = c.token()
    const body = c.order([{ productId: TOOR, qty: 2 }])
    const before = await c.stock(TOOR)
    const a = await c.call('POST', '/orders', body, t)
    const b = await c.call('POST', '/orders', body, t)
    expect(a.status).toBe(201)
    expect(b.json.data.id).toBe(a.json.data.id)
    expect(await c.stock(TOOR)).toBe(before! - 2)
    expect((await c.call('GET', '/orders', undefined, t)).json.data).toHaveLength(1)
  })

  it('reusing a key for a different basket is refused', async () => {
    const c = await boot()
    const t = c.token()
    const key = 'abcdefghijklmnop1234'
    await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }], { idempotencyKey: key }), t)
    const r = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 5 }], { idempotencyKey: key }), t)
    expect(r.status).toBe(409)
    expect(r.json.error.code).toBe('IDEMPOTENCY_KEY_REUSED')
  })
})

describe('privacy between customers', () => {
  it('another token sees a 404 identical to an unknown order', async () => {
    const c = await boot()
    const mine = c.token()
    const o = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }]), mine)
    const id = o.json.data.id
    const theirs = c.token()
    const peek = await c.call('GET', `/orders/${id}`, undefined, theirs)
    const nothing = await c.call('GET', '/orders/TH-00000000', undefined, theirs)
    expect(peek.status).toBe(404)
    expect(peek.json).toEqual(nothing.json)
    expect((await c.call('POST', `/orders/${id}/cancel`, undefined, theirs)).status).toBe(404)
    expect((await c.call('GET', '/orders', undefined, theirs)).json.data).toEqual([])
    expect((await c.call('GET', `/orders/${id}`, undefined, mine)).status).toBe(200)
  })
  it('malformed order ids are a 400, not a lookup', async () => {
    const c = await boot()
    expect((await c.call('GET', '/orders/not-an-id', undefined, c.token())).status).toBe(400)
  })
})

describe('simulated payments (no money ever moves)', () => {
  it('lists every method as a demo and exposes no secrets', async () => {
    const c = await boot()
    const r = await c.call('GET', '/payments/methods')
    expect(r.json.data.map((m: { id: string }) => m.id)).toEqual(['cod', 'upi_sim', 'online_sim'])
    expect(r.json.data.filter((m: { simulated: boolean }) => m.simulated).map((m: { id: string }) => m.id)).toEqual(['upi_sim', 'online_sim'])
    expect(r.text).not.toMatch(/secret|key_id|razorpay|token/i)
  })

  it('UPI sim: reserved + awaiting payment, then confirmed on success', async () => {
    const c = await boot()
    const t = c.token()
    const before = await c.stock(TOOR)
    const created = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }], { paymentMethod: 'upi_sim' }), t)
    const o = created.json.data
    expect(o.status).toBe('awaiting_payment')
    expect(o.payment).toMatchObject({ method: 'upi_sim', simulated: true, status: 'awaiting_payment' })
    expect(o.reservationExpiresAt).toBeTruthy()
    expect(await c.stock(TOOR)).toBe(before! - 1) // held while the customer pays

    const paid = await c.call('POST', `/orders/${o.id}/payment/simulate`, { outcome: 'success' }, t)
    expect(paid.status).toBe(200)
    expect(paid.json.data).toMatchObject({ status: 'confirmed', payment: { status: 'paid_simulated' } })
    expect(paid.json.data.reservationExpiresAt).toBeNull()
    expect(paid.json.data.storeOrders[0].status).toBe('placed')
    // settling twice is not allowed
    expect((await c.call('POST', `/orders/${o.id}/payment/simulate`, { outcome: 'success' }, t)).status).toBe(409)
  })

  it('a failed payment keeps the order and the held stock, and can be retried', async () => {
    const c = await boot()
    const t = c.token()
    const created = await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }], { paymentMethod: 'online_sim' }), t)
    const id = created.json.data.id
    const failed = await c.call('POST', `/orders/${id}/payment/simulate`, { outcome: 'failure' }, t)
    expect(failed.json.data).toMatchObject({ status: 'awaiting_payment', payment: { status: 'failed', attempts: 2 } })
    const retry = await c.call('POST', `/orders/${id}/payment/simulate`, { outcome: 'success' }, t)
    expect(retry.json.data.status).toBe('confirmed')
  })

  it('too many failures cancels the order and returns the stock', async () => {
    const c = await boot()
    const t = c.token()
    const before = await c.stock(TOOR)
    const id = (await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }], { paymentMethod: 'upi_sim' }), t)).json.data.id
    let last
    for (let i = 0; i < 5; i++) last = await c.call('POST', `/orders/${id}/payment/simulate`, { outcome: 'failure' }, t)
    expect(last!.json.data).toMatchObject({ status: 'cancelled', cancelReason: 'too_many_failed_payments', payment: { status: 'void' } })
    expect(await c.stock(TOOR)).toBe(before)
  })

  it('cash on delivery cannot be "settled" with the simulator', async () => {
    const c = await boot()
    const t = c.token()
    const id = (await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }]), t)).json.data.id
    expect((await c.call('POST', `/orders/${id}/payment/simulate`, { outcome: 'success' }, t)).status).toBe(409) // already confirmed
  })

  it('cancelling an unpaid order returns its stock; a confirmed order cannot be cancelled this way', async () => {
    const c = await boot()
    const t = c.token()
    const before = await c.stock(TOOR)
    const id = (await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 2 }], { paymentMethod: 'upi_sim' }), t)).json.data.id
    expect(await c.stock(TOOR)).toBe(before! - 2)
    const cancelled = await c.call('POST', `/orders/${id}/cancel`, undefined, t)
    expect(cancelled.json.data).toMatchObject({ status: 'cancelled', cancelReason: 'cancelled_by_customer' })
    expect(await c.stock(TOOR)).toBe(before)

    const cod = (await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }]), t)).json.data.id
    expect((await c.call('POST', `/orders/${cod}/cancel`, undefined, t)).status).toBe(409)
  })

  it('an unpaid order that is abandoned releases its stock when the reservation lapses', async () => {
    const c = await boot()
    const t = c.token()
    const before = await c.stock(TOOR)
    const id = (await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 3 }], { paymentMethod: 'upi_sim' }), t)).json.data.id
    expect(await c.stock(TOOR)).toBe(before! - 3)
    c.setNow(new Date(START.getTime() + 16 * 60_000)) // 16 minutes later; the hold is 15
    const o = await c.call('GET', `/orders/${id}`, undefined, t)
    expect(o.json.data).toMatchObject({ status: 'cancelled', cancelReason: 'payment_timeout', payment: { status: 'void' } })
    expect(await c.stock(TOOR)).toBe(before)
    // and paying after the timeout is refused
    expect((await c.call('POST', `/orders/${id}/payment/simulate`, { outcome: 'success' }, t)).status).toBe(409)
  })

  it('the hold does NOT lapse early', async () => {
    const c = await boot()
    const t = c.token()
    const id = (await c.call('POST', '/orders', c.order([{ productId: TOOR, qty: 1 }], { paymentMethod: 'upi_sim' }), t)).json.data.id
    c.setNow(new Date(START.getTime() + 14 * 60_000))
    expect((await c.call('GET', `/orders/${id}`, undefined, t)).json.data.status).toBe('awaiting_payment')
  })
})

describe('the last gate: items that expire while the customer is paying', () => {
  it('stock that crosses its expiry date mid-payment cancels the order and charges nothing', async () => {
    // 23:50 IST: curry leaves expire "tomorrow" (still sellable, near expiry). After IST midnight they are blocked.
    const late = new Date('2026-06-10T18:20:00Z')
    const c = await boot({ start: late })
    const leaves = pid('store-pasumai', 'Curry Leaves')
    const t = c.token()
    const before = await c.stock(leaves)
    expect(before).not.toBeNull()

    const created = await c.call('POST', '/orders', c.order([{ productId: leaves, qty: 2 }], { paymentMethod: 'upi_sim' }), t)
    expect(created.status).toBe(201)
    const id = created.json.data.id

    c.setNow(new Date('2026-06-10T18:34:00Z')) // 00:04 IST next day, 14 minutes in: still inside the 15-minute hold
    const paid = await c.call('POST', `/orders/${id}/payment/simulate`, { outcome: 'success' }, t)
    expect(paid.status).toBe(409)
    expect(paid.json.error.code).toBe('ORDER_CANCELLED_UNAVAILABLE')
    expect(paid.json.error.details).toMatchObject({ status: 'cancelled', cancelReason: 'items_unavailable', payment: { status: 'void' } })

    const after = await c.call('GET', `/orders/${id}`, undefined, t)
    expect(after.json.data.status).toBe('cancelled')
    expect(after.json.data.payment.status).toBe('void')
  })
})

describe('abuse protection', () => {
  it('rate-limits order creation per customer', async () => {
    const c = await boot({ rateLimits: { orderCreatePerMinute: 3 } })
    const t = c.token()
    const statuses: number[] = []
    for (let i = 0; i < 5; i++) statuses.push((await c.call('POST', '/orders', c.order([{ productId: BREAD, qty: 1 }]), t)).status)
    expect(statuses.slice(0, 3)).toEqual([201, 201, 201])
    expect(statuses.slice(3)).toEqual([429, 429])
    // a different customer is unaffected
    expect((await c.call('POST', '/orders', c.order([{ productId: BREAD, qty: 1 }]), c.token())).status).toBe(201)
  })

  it('rate-limit responses say when to retry', async () => {
    const c = await boot({ rateLimits: { orderCreatePerMinute: 1 } })
    const t = c.token()
    await c.call('POST', '/orders', c.order([{ productId: BREAD, qty: 1 }]), t)
    const r = await c.call('POST', '/orders', c.order([{ productId: BREAD, qty: 1 }]), t)
    expect(r.status).toBe(429)
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('the basket endpoint is limited too', async () => {
    const c = await boot({ rateLimits: { cartValidatePerMinute: 2 } })
    const s = []
    for (let i = 0; i < 4; i++) s.push((await c.call('POST', '/cart/validate', { lines: [], ...MARKET })).status)
    expect(s).toEqual([200, 200, 429, 429])
  })
})
