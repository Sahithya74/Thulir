import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { buildDemoCatalog } from '@thulir/shared'
import { createApp, type AppHandle } from './app.js'
import { DEMO_PASSWORD } from './modules/auth/demoUsers.js'
import { MemoryStorage } from './services/imageStorage.js'

const START = new Date('2026-06-10T06:30:00Z') // 12:00 IST
const SECRET = 'test-secret-'.padEnd(48, 'x')
const data = buildDemoCatalog(START)
const pid = (storeId: string, name: string) => {
  const p = data.products.find((x) => x.storeId === storeId && x.name.en === name)
  if (!p) throw new Error(`no product ${name}`)
  return p.id
}
const SV = 'store-selvam'
const SAGO = pid(SV, 'Sago') // expired batch
const FENNEL = pid(SV, 'Fennel Seeds') // unreadable expiry date
const RAGI = pid(SV, 'Ragi Flour') // ~14 days left (pantry near-expiry window is 30)
const TOOR = pid(SV, 'Toor Dal')

const SELVAM = 'owner.selvam@demo.thulir.test'

const open: { s: Server; app: AppHandle }[] = []
afterEach(async () => {
  for (const { s, app } of open.splice(0)) {
    app.stop()
    await new Promise<void>((r) => s.close(() => r()))
  }
})

interface Session {
  cookie: string
  csrf: string
}

async function boot(opts: { start?: Date; loginPerMinute?: number; seedDemo?: boolean } = {}) {
  let now = opts.start ?? START
  const images = new MemoryStorage()
  const app = createApp({ clock: () => now, jwtSecret: SECRET, bcryptCost: 4, images, seedDemo: opts.seedDemo, rateLimits: { loginPerMinute: opts.loginPerMinute ?? 100 } })
  await app.ready
  const s = await new Promise<Server>((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv))
  })
  open.push({ s, app })
  const base = `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/v1`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type R = { status: number; text: string; json: any; headers: Headers }
  async function call(method: string, path: string, body?: unknown, sess?: Session | null, opt: { csrf?: boolean; headers?: Record<string, string>; raw?: Buffer } = {}): Promise<R> {
    const headers: Record<string, string> = { ...opt.headers }
    if (body !== undefined && !opt.raw) headers['content-type'] = 'application/json'
    if (sess) {
      headers.cookie = sess.cookie
      if (opt.csrf !== false) headers['x-csrf-token'] = sess.csrf
    }
    const res = await fetch(base + path, { method, headers, body: opt.raw ?? (body === undefined ? undefined : JSON.stringify(body)) })
    const text = await res.text()
    let json: unknown = null
    try {
      json = JSON.parse(text)
    } catch {
      /* not json */
    }
    return { status: res.status, text, json, headers: res.headers }
  }

  async function login(email: string, password = DEMO_PASSWORD): Promise<Session & { res: R; setCookies: string[] }> {
    const res = await fetch(base + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const text = await res.text()
    const setCookies = res.headers.getSetCookie()
    const jar = setCookies.map((c) => c.split(';')[0]).join('; ')
    const csrf = setCookies.find((c) => c.startsWith('thulir_csrf='))?.split(';')[0].split('=')[1] ?? ''
    return { cookie: jar, csrf, setCookies, res: { status: res.status, text, json: text ? JSON.parse(text) : null, headers: res.headers } }
  }

  const owner = (path: string) => `/owner/stores/${SV}${path}`
  const row = async (sess: Session, productId: string) => (await call('GET', owner(`/products/${productId}`), undefined, sess)).json.data
  const customerSees = async (productId: string) => (await call('GET', `/products/${productId}`)).status === 200
  const guest = () => randomBytes(18).toString('base64url')
  const placeOrder = (token: string, lines: { productId: string; qty: number }[], paymentMethod = 'cod') =>
    call('POST', '/orders', {
      lines,
      address: { name: 'Anitha Kumar', phone: '9876543210', line1: '12, Temple Street', areaId: 'area-a-market', pincode: '600991', instructions: 'Ring twice' },
      slot: { kind: 'asap' },
      paymentMethod,
      idempotencyKey: randomBytes(12).toString('hex'),
    }, null, { headers: { 'x-guest-token': token } })

  return { app, images, call, login, owner, row, customerSees, guest, placeOrder, setNow: (d: Date) => (now = d) }
}

const MARKET = { lat: 11.2, lng: 78.15 }
const PARTNER = 'partner@demo.thulir.test'
const ADMIN = 'admin@demo.thulir.test'
const asGuest = (token: string) => ({ headers: { 'x-guest-token': token } })

/** Place an order and walk it to "handed over" as the store. */
async function handedOver(c: Awaited<ReturnType<typeof boot>>, qty = 1) {
  const token = c.guest()
  const o = (await c.placeOrder(token, [{ productId: TOOR, qty }])).json.data
  const so = o.storeOrders[0].id as string
  const s = await c.login(SELVAM)
  for (const to of ['accepted', 'preparing', 'ready', 'handed_over']) {
    const r = await c.call('POST', c.owner(`/orders/${so}/transition`), { to }, s)
    expect(r.status, to).toBe(200)
  }
  return { token, orderId: o.id as string, so }
}

/* ======================================================================= */
describe('delivery partner portal', () => {
  it('only partners get in', async () => {
    const c = await boot()
    expect((await c.call('GET', '/delivery/orders')).status).toBe(401)
    for (const email of [SELVAM, ADMIN, 'customer@demo.thulir.test']) {
      expect((await c.call('GET', '/delivery/orders', undefined, await c.login(email))).status, email).toBe(403)
    }
  })

  it('an order is assigned to a partner when the store marks it ready, not before', async () => {
    const c = await boot()
    const o = (await c.placeOrder(c.guest(), [{ productId: TOOR, qty: 1 }])).json.data
    const so = o.storeOrders[0].id
    const s = await c.login(SELVAM)
    const p = await c.login(PARTNER)
    for (const to of ['accepted', 'preparing']) await c.call('POST', c.owner(`/orders/${so}/transition`), { to }, s)
    expect((await c.call('GET', '/delivery/orders', undefined, p)).json.data.some((x: { id: string }) => x.id === so)).toBe(false)
    await c.call('POST', c.owner(`/orders/${so}/transition`), { to: 'ready' }, s)
    const mine = (await c.call('GET', '/delivery/orders', undefined, p)).json.data.find((x: { id: string }) => x.id === so)
    expect(mine).toMatchObject({ status: 'ready', nextSteps: [] })
    expect(mine.customer.pincode).toBe('600991')
    expect(JSON.stringify(mine)).not.toMatch(/deliveryCode/)
  })

  it('the road steps run in order, and "delivered" needs the customer\'s code', async () => {
    const c = await boot()
    const { token, orderId, so } = await handedOver(c)
    const p = await c.login(PARTNER)
    const go = (body: object) => c.call('POST', `/delivery/orders/${so}/transition`, body, p)
    expect((await go({ to: 'delivered', code: '0000' })).json.error.code).toBe('INVALID_TRANSITION')
    expect((await go({ to: 'out_for_delivery' })).json.data.status).toBe('out_for_delivery')
    const code = (await c.call('GET', `/orders/${orderId}`, undefined, null, asGuest(token))).json.data.storeOrders[0].deliveryCode
    expect(code).toMatch(/^\d{4}$/)
    expect((await go({ to: 'delivered' })).status).toBe(422)
    const wrong = code === '1234' ? '4321' : '1234'
    expect((await go({ to: 'delivered', code: wrong })).json.error.code).toBe('WRONG_CODE')
    const done = await go({ to: 'delivered', code })
    expect(done.json.data.status).toBe('delivered')
    const seen = (await c.call('GET', `/orders/${orderId}`, undefined, null, asGuest(token))).json.data
    expect(seen.storeOrders[0]).toMatchObject({ status: 'delivered', deliveryCode: null, partnerName: 'Ravi' }) // customers see the first name only
    expect(seen.storeOrders[0].partnerName).not.toMatch(/Kumar/)
    expect(seen.status).toBe('completed')
  })

  it('too many wrong codes lock the order, even for the right code', async () => {
    const c = await boot()
    const { token, orderId, so } = await handedOver(c)
    const p = await c.login(PARTNER)
    await c.call('POST', `/delivery/orders/${so}/transition`, { to: 'out_for_delivery' }, p)
    const code = (await c.call('GET', `/orders/${orderId}`, undefined, null, asGuest(token))).json.data.storeOrders[0].deliveryCode
    const wrong = code === '1111' ? '2222' : '1111'
    for (let i = 0; i < 5; i++) expect((await c.call('POST', `/delivery/orders/${so}/transition`, { to: 'delivered', code: wrong }, p)).status).toBe(422)
    expect((await c.call('POST', `/delivery/orders/${so}/transition`, { to: 'delivered', code }, p)).json.error.code).toBe('CODE_LOCKED')
  })

  it('the code is shown to the customer only while the order is on the road', async () => {
    const c = await boot()
    const token = c.guest()
    const o = (await c.placeOrder(token, [{ productId: TOOR, qty: 1 }])).json.data
    const view = async () => (await c.call('GET', `/orders/${o.id}`, undefined, null, asGuest(token))).json.data.storeOrders[0]
    expect((await view()).deliveryCode).toBeNull()
    const s = await c.login(SELVAM)
    for (const to of ['accepted', 'preparing', 'ready']) await c.call('POST', c.owner(`/orders/${o.storeOrders[0].id}/transition`), { to }, s)
    expect((await view()).deliveryCode).toBeNull()
    await c.call('POST', c.owner(`/orders/${o.storeOrders[0].id}/transition`), { to: 'handed_over' }, s)
    expect((await view()).deliveryCode).toMatch(/^\d{4}$/)
    // the store never sees it
    expect(JSON.stringify((await c.call('GET', c.owner('/orders'), undefined, s)).json)).not.toMatch(/deliveryCode/)
  })

  it('a partner cannot move a store\'s kitchen steps, nor orders that are not theirs', async () => {
    const c = await boot()
    const o = (await c.placeOrder(c.guest(), [{ productId: TOOR, qty: 1 }])).json.data
    const p = await c.login(PARTNER)
    const r = await c.call('POST', `/delivery/orders/${o.storeOrders[0].id}/transition`, { to: 'accepted' }, p)
    expect(r.status).toBe(404) // not assigned to them, so it does not exist for them
    expect((await c.call('POST', '/delivery/orders/SO-NOPE/transition', { to: 'delivered', code: '1234' }, p)).status).toBe(404)
  })

  it('partner actions need the CSRF header', async () => {
    const c = await boot()
    const { so } = await handedOver(c)
    const p = await c.login(PARTNER)
    expect((await c.call('POST', `/delivery/orders/${so}/transition`, { to: 'out_for_delivery' }, p, { csrf: false })).status).toBe(403)
  })
})

/* ======================================================================= */
describe('platform admin portal', () => {
  it('only admins get in', async () => {
    const c = await boot()
    expect((await c.call('GET', '/admin/stores')).status).toBe(401)
    for (const email of [SELVAM, PARTNER, 'customer@demo.thulir.test']) {
      const s = await c.login(email)
      for (const path of ['/stores', '/orders', '/compliance', '/analytics', '/policies', '/audit']) {
        expect((await c.call('GET', `/admin${path}`, undefined, s)).status, `${email} ${path}`).toBe(403)
      }
    }
  })

  it('lists every store honestly: demo stores are never shown as verified businesses', async () => {
    const c = await boot()
    const a = await c.login(ADMIN)
    const rows = (await c.call('GET', '/admin/stores', undefined, a)).json.data
    expect(rows).toHaveLength(6)
    for (const r of rows) {
      expect(r.isDemo).toBe(true)
      expect(r.verification).not.toBe('verified')
      expect(r.products).toBeGreaterThan(0)
    }
    expect(rows.find((r: { id: string }) => r.id === SV).expiredOrBlocked).toBeGreaterThan(0)
  })

  it('suspending a store hides it from customers and stops new orders; reinstating brings it back', async () => {
    const c = await boot()
    const a = await c.login(ADMIN)
    expect((await c.call('POST', `/admin/stores/${SV}/status`, { status: 'suspended' }, a)).status).toBe(400)
    const r = await c.call('POST', `/admin/stores/${SV}/status`, { status: 'suspended', reason: 'Repeated expired stock' }, a)
    expect(r.json.data.status).toBe('suspended')
    expect((await c.call('GET', '/stores')).json.data.some((s: { id: string }) => s.id === SV)).toBe(false)
    expect((await c.call('GET', `/stores/${SV}`)).status).toBe(404)
    expect((await c.call('GET', `/products/${TOOR}`)).status).toBe(404)
    const cart = await c.call('POST', '/cart/validate', { lines: [{ productId: TOOR, qty: 1 }], ...MARKET })
    expect(JSON.stringify(cart.json)).toMatch(/UNAVAILABLE|NOT_FOUND|removed/)
    const order = await c.placeOrder(c.guest(), [{ productId: TOOR, qty: 1 }])
    expect(order.status).toBeGreaterThanOrEqual(400)
    // the owner can still sign in and see their own data
    expect((await c.call('GET', c.owner('/inventory'), undefined, await c.login(SELVAM))).status).toBe(200)
    await c.call('POST', `/admin/stores/${SV}/status`, { status: 'active', reason: 'Stock cleaned up' }, a)
    expect((await c.call('GET', `/products/${TOOR}`)).status).toBe(200)
    const audit = (await c.call('GET', `/admin/audit?storeId=${SV}`, undefined, a)).json.data.map((x: { action: string }) => x.action)
    expect(audit.slice(0, 2)).toEqual(['store.reinstate', 'store.suspend'])
  })

  it('an admin can cancel an order with a reason; stock returns and the refund is recorded as simulated', async () => {
    const c = await boot()
    const token = c.guest()
    const before = (await c.call('GET', `/products/${TOOR}`)).json.data.hit.product.eligibility.sellableQty
    const o = (await c.placeOrder(token, [{ productId: TOOR, qty: 2 }], 'upi_sim')).json.data
    await c.call('POST', `/orders/${o.id}/payment/simulate`, { outcome: 'success' }, null, asGuest(token))
    const so = o.storeOrders[0].id
    const a = await c.login(ADMIN)
    expect((await c.call('POST', `/admin/orders/${so}/cancel`, {}, a)).status).toBe(400)
    const r = await c.call('POST', `/admin/orders/${so}/cancel`, { reason: 'Customer called support' }, a)
    expect(r.status).toBe(200)
    expect(r.json.data.status).toBe('cancelled')
    expect((await c.call('GET', `/products/${TOOR}`)).json.data.hit.product.eligibility.sellableQty).toBe(before)
    const seen = (await c.call('GET', `/orders/${o.id}`, undefined, null, asGuest(token))).json.data.storeOrders[0]
    expect(seen.status).toBe('cancelled')
    // already cancelled: cannot be cancelled again
    expect((await c.call('POST', `/admin/orders/${so}/cancel`, { reason: 'Second try here' }, a)).status).toBe(409)
  })

  it('an admin cannot cancel an order that is already on the road', async () => {
    const c = await boot()
    const { so } = await handedOver(c)
    const a = await c.login(ADMIN)
    expect((await c.call('POST', `/admin/orders/${so}/cancel`, { reason: 'Too late for this' }, a)).status).toBe(409)
  })

  it('admin order list masks the customer phone', async () => {
    const c = await boot()
    await c.placeOrder(c.guest(), [{ productId: TOOR, qty: 1 }])
    const a = await c.login(ADMIN)
    const rows = (await c.call('GET', '/admin/orders', undefined, a)).json.data
    expect(rows.length).toBeGreaterThan(0)
    expect(JSON.stringify(rows)).not.toMatch(/9876543210/)
  })

  it('compliance lists hidden products across stores, with reasons', async () => {
    const c = await boot()
    const a = await c.login(ADMIN)
    const rows = (await c.call('GET', '/admin/compliance', undefined, a)).json.data
    const sago = rows.find((r: { productId: string }) => r.productId === SAGO)
    expect(sago).toMatchObject({ storeId: SV, status: 'expired' })
    expect(sago.reasons.length).toBeGreaterThan(0)
    expect(rows.some((r: { productId: string }) => r.productId === FENNEL)).toBe(true)
  })

  it('platform policy changes need a reason, are bounded, audited, and change what customers can buy', async () => {
    const c = await boot()
    const a = await c.login(ADMIN)
    expect(await c.customerSees(RAGI)).toBe(true) // ~14 days left; pantry near-expiry window is 30 but near-expiry pantry still sells
    expect((await c.call('PUT', '/admin/policies/pantry', { sellNearExpiry: false }, a)).status).toBe(400)
    expect((await c.call('PUT', '/admin/policies/pantry', { nearExpiryDays: 999, reason: 'testing bounds' }, a)).status).toBe(400)
    expect((await c.call('PUT', '/admin/policies/pantry', { reason: 'nothing to change' }, a)).status).toBe(422)
    const r = await c.call('PUT', '/admin/policies/pantry', { sellNearExpiry: false, reason: 'Stricter pantry freshness' }, a)
    expect(r.status).toBe(200)
    expect(r.json.data.departments.pantry).toMatchObject({ sellNearExpiry: false })
    expect(await c.customerSees(RAGI)).toBe(false)
    const audit = (await c.call('GET', '/admin/audit', undefined, a)).json.data[0]
    expect(audit).toMatchObject({ action: 'platform.policy', reason: 'Stricter pantry freshness', storeId: null })
  })

  it('analytics add up', async () => {
    const c = await boot()
    await c.placeOrder(c.guest(), [{ productId: TOOR, qty: 1 }])
    const a = await c.login(ADMIN)
    const d = (await c.call('GET', '/admin/analytics', undefined, a)).json.data
    expect(d.stores).toEqual({ total: 6, active: 6, suspended: 0 })
    expect(d.orders.total).toBe(1)
    expect(d.gmvPaise).toBeGreaterThan(0)
    expect(d.freshness.sellable + d.freshness.hiddenByChecks).toBeLessThanOrEqual(d.freshness.products)
    expect(d.perStore.reduce((n: number, s: { gmvPaise: number }) => n + s.gmvPaise, 0)).toBe(d.gmvPaise)
  })

  it('admin changes need the CSRF header', async () => {
    const c = await boot()
    const a = await c.login(ADMIN)
    expect((await c.call('POST', `/admin/stores/${SV}/status`, { status: 'suspended', reason: 'no csrf header' }, a, { csrf: false })).status).toBe(403)
  })
})
