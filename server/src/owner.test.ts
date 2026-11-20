import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
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
const MM_TOOR = pid('store-marutham', 'Toor Dal')

const SELVAM = 'owner.selvam@demo.thulir.test'
const MARUTHAM = 'owner.marutham@demo.thulir.test'

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

/* ======================================================================= */
describe('sign-in', () => {
  it('a correct sign-in returns the user without any secret, and sets hardened cookies', async () => {
    const c = await boot()
    const r = await c.login(SELVAM)
    expect(r.res.status).toBe(200)
    expect(r.res.json.data).toMatchObject({ email: SELVAM, role: 'store_owner', storeIds: [SV] })
    expect(r.res.text).not.toMatch(/passwordHash|\$2[aby]\$/)
    const session = r.setCookies.find((x) => x.startsWith('thulir_session='))!
    expect(session).toMatch(/HttpOnly/i)
    expect(session).toMatch(/SameSite=Lax/i)
    expect(session).toMatch(/Path=\/api/i)
    const csrf = r.setCookies.find((x) => x.startsWith('thulir_csrf='))!
    expect(csrf).not.toMatch(/HttpOnly/i)
  })

  it('wrong password and unknown email get the identical answer', async () => {
    const c = await boot()
    const a = await c.login(SELVAM, 'wrong-password')
    const b = await c.login('nobody@example.com', 'whatever')
    expect(a.res.status).toBe(401)
    expect(a.res.json).toEqual(b.res.json)
    expect(a.setCookies.filter((x) => x.startsWith('thulir_session='))).toEqual([])
  })

  it('/auth/me needs a valid session', async () => {
    const c = await boot()
    expect((await c.call('GET', '/auth/me')).status).toBe(401)
    const s = await c.login(SELVAM)
    expect((await c.call('GET', '/auth/me', undefined, s)).json.data.email).toBe(SELVAM)
  })

  it('forged, re-signed and "alg: none" tokens are all rejected', async () => {
    const c = await boot()
    const forged = { cookie: `thulir_session=${jwt.sign({ sub: 'u-owner-selvam' }, 'some-other-secret-that-is-long-enough!!')}`, csrf: '' }
    expect((await c.call('GET', '/auth/me', undefined, forged)).status).toBe(401)
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const none = { cookie: `thulir_session=${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'u-owner-selvam' })}.`, csrf: '' }
    expect((await c.call('GET', '/auth/me', undefined, none)).status).toBe(401)
    const real = await c.login(SELVAM)
    const tampered = { cookie: real.cookie.replace(/thulir_session=([^;]+)/, (_m, t: string) => `thulir_session=${t.slice(0, -2)}xx`), csrf: '' }
    expect((await c.call('GET', '/auth/me', undefined, tampered)).status).toBe(401)
  })

  it('an expired session is rejected', async () => {
    const c = await boot()
    const old = { cookie: `thulir_session=${jwt.sign({ sub: 'u-owner-selvam', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET)}`, csrf: '' }
    expect((await c.call('GET', '/auth/me', undefined, old)).status).toBe(401)
  })

  it('sign-in attempts are rate-limited', async () => {
    const c = await boot({ loginPerMinute: 3 })
    const s: number[] = []
    for (let i = 0; i < 5; i++) s.push((await c.login(SELVAM, 'nope')).res.status)
    expect(s).toEqual([401, 401, 401, 429, 429])
  })

  it('sign-out needs the CSRF header and clears both cookies', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    expect((await c.call('POST', '/auth/logout', undefined, s, { csrf: false })).status).toBe(403)
    const out = await c.call('POST', '/auth/logout', undefined, s)
    expect(out.status).toBe(200)
    const cleared = out.headers.getSetCookie().join('\n')
    expect(cleared).toMatch(/thulir_session=;/)
    expect(cleared).toMatch(/thulir_csrf=;/)
  })
})

/* ======================================================================= */
describe('who may reach the owner portal', () => {
  it('nobody signed in: 401', async () => {
    const c = await boot()
    expect((await c.call('GET', c.owner('/inventory'))).status).toBe(401)
  })

  it.each([
    ['a customer', 'customer@demo.thulir.test'],
    ['a delivery partner', 'partner@demo.thulir.test'],
    ['a platform admin (owner tools are owner-only in this phase)', 'admin@demo.thulir.test'],
  ])('%s: 403', async (_who, email) => {
    const c = await boot()
    const s = await c.login(email)
    expect((await c.call('GET', c.owner('/inventory'), undefined, s)).status).toBe(403)
  })

  it('another store\'s owner: 403, identical to an unknown store id', async () => {
    const c = await boot()
    const s = await c.login(MARUTHAM)
    const foreign = await c.call('GET', `/owner/stores/${SV}/inventory`, undefined, s)
    const unknown = await c.call('GET', '/owner/stores/store-nowhere/inventory', undefined, s)
    expect(foreign.status).toBe(403)
    expect(foreign.json).toEqual(unknown.json)
    for (const path of ['/orders', '/notifications', '/audit', '/dashboard', '/expiry', '/policies']) {
      expect((await c.call('GET', `/owner/stores/${SV}${path}`, undefined, s)).status).toBe(403)
    }
  })

  it('an owner reaching another store\'s product through their own store\'s URL gets a 404', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    expect((await c.call('GET', c.owner(`/products/${MM_TOOR}`), undefined, s)).status).toBe(404)
    expect((await c.call('PATCH', c.owner(`/products/${MM_TOOR}`), { pricePaise: 100 }, s)).status).toBe(404)
    expect((await c.call('POST', c.owner(`/products/${MM_TOOR}/availability`), { available: false, reason: 'trying it' }, s)).status).toBe(404)
  })

  it('writes need the CSRF header; reads do not', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    expect((await c.call('GET', c.owner('/inventory'), undefined, s, { csrf: false })).status).toBe(200)
    const noHeader = await c.call('POST', c.owner(`/products/${TOOR}/availability`), { available: false, reason: 'test reason' }, s, { csrf: false })
    expect(noHeader.status).toBe(403)
    expect(noHeader.json.error.code).toBe('CSRF_FAILED')
    const wrong = await c.call('POST', c.owner(`/products/${TOOR}/availability`), { available: false, reason: 'test reason' }, s, { csrf: false, headers: { 'x-csrf-token': 'not-the-token' } })
    expect(wrong.status).toBe(403)
    expect(await c.customerSees(TOOR)).toBe(true) // nothing changed
  })

  it('unknown fields in owner requests are refused', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    expect((await c.call('POST', c.owner(`/products/${TOOR}/availability`), { available: false, reason: 'reason here', eligible: true }, s)).status).toBe(400)
  })
})

/* ======================================================================= */
describe('inventory: what the owner sees', () => {
  it('owners see everything — including what customers never see — with the engine\'s reasons', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const rows = (await c.call('GET', c.owner('/inventory'), undefined, s)).json.data
    expect(rows.length).toBeGreaterThan(10)
    expect(rows.every((r: { product: { storeId: string } }) => r.product.storeId === SV)).toBe(true)
    const by = (id: string) => rows.find((r: { product: { id: string } }) => r.product.id === id)
    expect(by(SAGO)).toMatchObject({ status: 'expired', buckets: ['expired'] })
    expect(by(FENNEL)).toMatchObject({ status: 'requires_review', buckets: ['needs_review', 'invalid_expiry'] })
    expect(by(RAGI)).toMatchObject({ status: 'near_expiry', buckets: ['expiring_soon'] })
    expect(by(SAGO).batches[0]).toMatchObject({ kind: 'expired' })
    expect(await c.customerSees(SAGO)).toBe(false)
  })

  it('filters by status, worklist and text', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const ids = async (q: string) => (await c.call('GET', c.owner(`/inventory?${q}`), undefined, s)).json.data.map((r: { product: { id: string } }) => r.product.id)
    expect(await ids('status=expired')).toEqual([SAGO])
    expect(await ids('bucket=invalid_expiry')).toEqual([FENNEL])
    expect(await ids('q=ragi')).toEqual([RAGI])
  })

  it('the expiry page lists worklists in priority order', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const r = (await c.call('GET', c.owner('/expiry'), undefined, s)).json.data
    expect(r.order).toEqual(['expired', 'expires_today', 'expiring_soon', 'needs_review', 'invalid_expiry', 'blocked'])
    expect(r.buckets.expired.map((x: { product: { id: string } }) => x.product.id)).toContain(SAGO)
    expect(r.buckets.invalid_expiry.map((x: { product: { id: string } }) => x.product.id)).toContain(FENNEL)
  })
})

/* ======================================================================= */
describe('closing the loopholes: expired stock cannot be made sellable', () => {
  it('re-dating an expired batch is refused', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const r = await c.call('PATCH', c.owner(`/products/${SAGO}/batches/${SAGO}-b1/expiry`), { expiryDate: '2027-01-01', reason: 'printing error' }, s)
    expect(r.status).toBe(422)
    expect(r.json.error.code).toBe('CANNOT_REDATE_EXPIRED')
    expect(await c.customerSees(SAGO)).toBe(false)
  })

  it('switching an expired product "on" does not put it on sale', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    await c.call('POST', c.owner(`/products/${SAGO}/availability`), { available: false, reason: 'cleaning shelf' }, s)
    const back = await c.call('POST', c.owner(`/products/${SAGO}/availability`), { available: true }, s)
    expect(back.status).toBe(200)
    expect(back.json.data.status).toBe('expired')
    expect(await c.customerSees(SAGO)).toBe(false)
  })

  it('unblocking an expired batch does not put it on sale', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    await c.call('POST', c.owner(`/products/${SAGO}/batches/${SAGO}-b1/status`), { status: 'blocked', reason: 'checking it' }, s)
    const r = await c.call('POST', c.owner(`/products/${SAGO}/batches/${SAGO}-b1/status`), { status: 'active' }, s)
    expect(r.json.data.status).toBe('expired')
    expect(await c.customerSees(SAGO)).toBe(false)
  })

  it('turning expiry tracking off is platform-only', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const r = await c.call('PATCH', c.owner(`/products/${SAGO}`), { requiresExpiry: false }, s)
    expect(r.status).toBe(403)
    expect(r.json.error.code).toBe('ADMIN_ONLY')
    expect(await c.customerSees(SAGO)).toBe(false)
  })

  it('switching off expiry-day blocking is platform-only', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const r = await c.call('PUT', c.owner('/policies/pantry'), { blockOnExpiryDay: false, reason: 'want to sell more' }, s)
    expect(r.status).toBe(403)
    expect(r.json.error.code).toBe('ADMIN_ONLY')
  })

  it('stock that is already expired, or expires today, cannot be received', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    for (const expiryDate of ['2026-06-09', '2026-06-10']) {
      const r = await c.call('POST', c.owner(`/products/${TOOR}/batches`), { batchNo: `X-${expiryDate}`, qty: 10, expiryDate }, s)
      expect(r.status).toBe(422)
      expect(r.json.error.code).toBe('EXPIRY_IN_PAST')
    }
  })

  it.each([
    ['no date for a dated product', { batchNo: 'A1', qty: 5 }, 'EXPIRY_REQUIRED'],
    ['an impossible date', { batchNo: 'A2', qty: 5, expiryDate: '2026-02-30' }, 'INVALID_EXPIRY_DATE'],
    ['a date in another format', { batchNo: 'A3', qty: 5, expiryDate: '30/06/2027' }, 'INVALID_EXPIRY_DATE'],
    ['a typo decades away', { batchNo: 'A4', qty: 5, expiryDate: '2062-01-01' }, 'EXPIRY_TOO_FAR'],
    ['zero quantity', { batchNo: 'A5', qty: 0, expiryDate: '2027-01-01' }, 'INVALID_QUANTITY'],
    ['fractional quantity', { batchNo: 'A6', qty: 2.5, expiryDate: '2027-01-01' }, 'INVALID_QUANTITY'],
    ['a bad batch number', { batchNo: '../../etc', qty: 5, expiryDate: '2027-01-01' }, 'INVALID_BATCH_NO'],
  ])('receiving stock with %s is refused', async (_n, body, code) => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const r = await c.call('POST', c.owner(`/products/${TOOR}/batches`), body, s)
    expect(r.status).toBe(422)
    expect(r.json.error.code).toBe(code)
  })
})

/* ======================================================================= */
describe('legitimate inventory work', () => {
  it('receiving fresh stock increases what customers can buy, and is audited', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const before = (await c.call('GET', `/products/${TOOR}`)).json.data.hit.product.eligibility.sellableQty
    const r = await c.call('POST', c.owner(`/products/${TOOR}/batches`), { batchNo: 'td-2027-a', qty: 24, expiryDate: '2027-03-01' }, s)
    expect(r.status).toBe(201)
    expect(r.json.data.batches.some((b: { batchNo: string }) => b.batchNo === 'TD-2027-A')).toBe(true)
    expect((await c.call('GET', `/products/${TOOR}`)).json.data.hit.product.eligibility.sellableQty).toBe(before + 24)
    expect((await c.call('POST', c.owner(`/products/${TOOR}/batches`), { batchNo: 'TD-2027-A', qty: 1, expiryDate: '2027-03-01' }, s)).status).toBe(409)
    const audit = (await c.call('GET', c.owner('/audit'), undefined, s)).json.data
    expect(audit[0]).toMatchObject({ action: 'batch.receive', actorName: expect.stringContaining('Selvam') })
  })

  it('a batch with an unreadable date can be corrected (with a reason) and goes back on sale', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    expect(await c.customerSees(FENNEL)).toBe(false)
    expect((await c.call('PATCH', c.owner(`/products/${FENNEL}/batches/${FENNEL}-b1/expiry`), { expiryDate: '2027-06-10' }, s)).json.error.code).toBe('REASON_REQUIRED')
    const r = await c.call('PATCH', c.owner(`/products/${FENNEL}/batches/${FENNEL}-b1/expiry`), { expiryDate: '2027-06-10', reason: 'Date was typed wrongly at receiving' }, s)
    expect(r.status).toBe(200)
    expect(r.json.data.status).toBe('eligible')
    expect(await c.customerSees(FENNEL)).toBe(true)
    const a = (await c.call('GET', c.owner('/audit'), undefined, s)).json.data[0]
    expect(a).toMatchObject({ action: 'batch.expiry', reason: 'Date was typed wrongly at receiving', before: { expiryDate: '31/02/26' }, after: { expiryDate: '2027-06-10' } })
  })

  it('quantity adjustments need a reason and cannot go below zero', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const url = c.owner(`/products/${TOOR}/batches/${TOOR}-b1/qty`)
    expect((await c.call('PATCH', url, { delta: -5 }, s)).json.error.code).toBe('REASON_REQUIRED')
    expect((await c.call('PATCH', url, { delta: -500, reason: 'damaged in rain' }, s)).json.error.code).toBe('NEGATIVE_STOCK')
    const ok = await c.call('PATCH', url, { delta: -5, reason: 'damaged in rain' }, s)
    expect(ok.status).toBe(200)
    expect(ok.json.data.batches[0].qty).toBe(35)
  })

  it('a written-off batch stays written off', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const url = c.owner(`/products/${TOOR}/batches/${TOOR}-b1/status`)
    const r = await c.call('POST', url, { status: 'removed', reason: 'pests found' }, s)
    expect(r.status).toBe(200)
    // Its only batch is gone, so the engine blocks the product and customers no longer see it.
    expect(r.json.data.status).toBe('blocked')
    expect(await c.customerSees(TOOR)).toBe(false)
    expect((await c.call('POST', url, { status: 'active' }, s)).json.error.code).toBe('BATCH_REMOVED')
  })

  it('switching a product off or marking it for removal needs a reason and hides it at once', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    expect((await c.call('POST', c.owner(`/products/${TOOR}/flag`), { flagged: true }, s)).status).toBe(422)
    expect((await c.call('POST', c.owner(`/products/${TOOR}/flag`), { flagged: true, reason: 'supplier recall' }, s)).status).toBe(200)
    expect(await c.customerSees(TOOR)).toBe(false)
  })

  it('price rules: never above MRP, never below ₹1', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    expect((await c.call('PATCH', c.owner(`/products/${TOOR}`), { pricePaise: 9600 }, s)).json.error.code).toBe('PRICE_ABOVE_MRP')
    expect((await c.call('PATCH', c.owner(`/products/${TOOR}`), { pricePaise: 50 }, s)).json.error.code).toBe('INVALID_PRICE')
    const ok = await c.call('PATCH', c.owner(`/products/${TOOR}`), { pricePaise: 8000, reason: 'weekly offer' }, s)
    expect(ok.json.data.product.pricePaise).toBe(8000)
    expect((await c.call('GET', `/products/${TOOR}`)).json.data.hit.product.pricePaise).toBe(8000)
  })
})

/* ======================================================================= */
describe('adding a product', () => {
  const good = {
    name: { en: 'Groundnut Oil', ta: 'கடலை எண்ணெய்' },
    brand: 'Selvam Select',
    department: 'pantry',
    unit: '1 litre',
    pricePaise: 21000,
    mrpPaise: 23000,
    description: 'Cold-pressed groundnut oil.',
    shape: 'bottle',
    tags: ['oil'],
    veg: true,
    requiresExpiry: true,
    initialBatch: { batchNo: 'GN-001', qty: 20, expiryDate: '2027-01-15' },
  }

  it('a valid product goes on sale and is audited', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const r = await c.call('POST', c.owner('/products'), good, s)
    expect(r.status).toBe(201)
    const id = r.json.data.product.id
    expect(r.json.data.status).toBe('eligible')
    expect(await c.customerSees(id)).toBe(true)
    expect((await c.call('GET', c.owner('/audit'), undefined, s)).json.data[0].action).toBe('product.create')
  })

  it('a rejected product leaves nothing behind', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const count = async () => (await c.call('GET', c.owner('/inventory'), undefined, s)).json.data.length
    const before = await count()
    for (const bad of [
      { ...good, initialBatch: { ...good.initialBatch, expiryDate: '2026-06-01' } },
      { ...good, pricePaise: 30000 },
      { ...good, unit: 'big' },
      { ...good, requiresExpiry: false },
    ]) {
      expect((await c.call('POST', c.owner('/products'), bad, s)).status).toBe(422)
    }
    expect(await count()).toBe(before)
  })
})

/* ======================================================================= */
describe('freshness rules the owner may set (within limits)', () => {
  it('a shorter near-expiry window turns a near-expiry item back into plain stock', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const r = await c.call('PUT', c.owner('/policies/pantry'), { nearExpiryDays: 5, reason: 'pantry goods keep well' }, s)
    expect(r.status).toBe(200)
    expect(r.json.data.departments.pantry.nearExpiryDays).toBe(5)
    expect((await c.row(s, RAGI)).status).toBe('eligible')
  })

  it('"do not sell near-expiry stock" takes it off sale for customers immediately', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    expect(await c.customerSees(RAGI)).toBe(true)
    await c.call('PUT', c.owner('/policies/pantry'), { sellNearExpiry: false, reason: 'quality first' }, s)
    expect(await c.customerSees(RAGI)).toBe(false)
    expect((await c.row(s, RAGI)).buckets).toContain('needs_review')
  })

  it('the policy also governs what can be ordered, not just what is shown', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    await c.call('PUT', c.owner('/policies/pantry'), { sellNearExpiry: false, reason: 'quality first' }, s)
    const r = await c.placeOrder(c.guest(), [{ productId: RAGI, qty: 1 }])
    expect(r.status).toBe(409)
  })

  it('limits and reasons are enforced; another store is unaffected', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    expect((await c.call('PUT', c.owner('/policies/pantry'), { nearExpiryDays: 91, reason: 'too long a window' }, s)).status).toBe(422)
    expect((await c.call('PUT', c.owner('/policies/pantry'), { nearExpiryDays: 5 }, s)).json.error.code).toBe('REASON_REQUIRED')
    await c.call('PUT', c.owner('/policies/pantry'), { sellNearExpiry: false, reason: 'quality first' }, s)
    const m = await c.login(MARUTHAM)
    expect((await c.call('GET', '/owner/stores/store-marutham/policies', undefined, m)).json.data.departments).toEqual({})
  })
})

/* ======================================================================= */
describe('alerts', () => {
  it('existing problems are announced at start-up, most urgent first, in-app only', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const r = await c.call('GET', c.owner('/notifications'), undefined, s)
    const titles: string[] = r.json.data.map((n: { title: string }) => n.title)
    expect(titles).toEqual(expect.arrayContaining(['Expired: Sago', 'Unreadable expiry date: Fennel Seeds', 'Expiring soon: Ragi Flour', 'Low stock: Beaten Rice (Poha)']))
    expect(r.json.meta.channelNote).toMatch(/In-app only/)
    for (const n of r.json.data) {
      expect(n.deliveries).toEqual([
        { channel: 'in_app', status: 'delivered' },
        { channel: 'email', status: 'not_configured' },
        { channel: 'sms', status: 'not_configured' },
        { channel: 'whatsapp', status: 'not_configured' },
      ])
    }
  })

  it('the same situation is announced once, however many times it is scanned', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    expect((await c.call('POST', c.owner('/expiry/scan'), {}, s)).json.data.created).toBe(0)
    expect((await c.call('POST', c.owner('/expiry/scan'), {}, s)).json.data.created).toBe(0)
  })

  it('a new situation is announced: stock crossing its date while the server runs', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    c.setNow(new Date(START.getTime() + 20 * 86_400_000)) // ragi flour (≈14 days) is now past its date
    expect((await c.call('POST', c.owner('/expiry/scan'), {}, s)).json.data.created).toBeGreaterThan(0)
    const titles = (await c.call('GET', c.owner('/notifications'), undefined, s)).json.data.map((n: { title: string }) => n.title)
    expect(titles).toContain('Expired: Ragi Flour')
    expect(await c.customerSees(RAGI)).toBe(false)
  })

  it('read state: one, then all', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const list = (await c.call('GET', c.owner('/notifications'), undefined, s)).json
    expect(list.meta.unread).toBeGreaterThan(1)
    await c.call('POST', c.owner(`/notifications/${list.data[0].id}/read`), {}, s)
    expect((await c.call('GET', c.owner('/notifications'), undefined, s)).json.meta.unread).toBe(list.meta.unread - 1)
    await c.call('POST', c.owner('/notifications/read-all'), {}, s)
    expect((await c.call('GET', c.owner('/notifications'), undefined, s)).json.meta.unread).toBe(0)
  })

  it('a new order is announced to that store only', async () => {
    const c = await boot()
    await c.placeOrder(c.guest(), [{ productId: TOOR, qty: 1 }])
    const s = await c.login(SELVAM)
    expect((await c.call('GET', c.owner('/notifications'), undefined, s)).json.data[0]).toMatchObject({ kind: 'order', title: expect.stringMatching(/^New order TH-/) })
    const m = await c.login(MARUTHAM)
    const theirs = (await c.call('GET', '/owner/stores/store-marutham/notifications', undefined, m)).json.data
    expect(theirs.some((n: { kind: string }) => n.kind === 'order')).toBe(false)
  })
})

/* ======================================================================= */
describe('order management', () => {
  it('the owner sees the order with only what they need: first name and area, not phone or street', async () => {
    const c = await boot()
    const o = (await c.placeOrder(c.guest(), [{ productId: TOOR, qty: 2 }])).json.data
    const s = await c.login(SELVAM)
    const r = await c.call('GET', c.owner('/orders'), undefined, s)
    const mine = r.json.data.find((x: { orderId: string }) => x.orderId === o.id)
    expect(mine).toMatchObject({ status: 'placed', customerFirstName: 'Anitha', nextSteps: expect.arrayContaining(['accepted', 'rejected']) })
    expect(r.text).not.toContain('9876543210')
    expect(r.text).not.toContain('Temple Street')
  })

  it('the full kitchen path, visible to the customer as it happens', async () => {
    const c = await boot()
    const token = c.guest()
    const o = (await c.placeOrder(token, [{ productId: TOOR, qty: 1 }])).json.data
    const so = o.storeOrders[0].id
    const s = await c.login(SELVAM)
    for (const to of ['accepted', 'preparing', 'ready', 'handed_over']) {
      const r = await c.call('POST', c.owner(`/orders/${so}/transition`), { to }, s)
      expect(r.status, to).toBe(200)
      expect(r.json.data.status).toBe(to)
    }
    const seen = (await c.call('GET', `/orders/${o.id}`, undefined, null, { headers: { 'x-guest-token': token } })).json.data.storeOrders[0]
    expect(seen.status).toBe('handed_over')
    expect(seen.history.map((h: { status: string }) => h.status)).toEqual(['placed', 'accepted', 'preparing', 'ready', 'handed_over'])
  })

  it('steps cannot be skipped, and the road steps belong to the delivery partner', async () => {
    const c = await boot()
    const o = (await c.placeOrder(c.guest(), [{ productId: TOOR, qty: 1 }])).json.data
    const so = o.storeOrders[0].id
    const s = await c.login(SELVAM)
    expect((await c.call('POST', c.owner(`/orders/${so}/transition`), { to: 'ready' }, s)).json.error.code).toBe('INVALID_TRANSITION')
    for (const to of ['accepted', 'preparing', 'ready', 'handed_over']) await c.call('POST', c.owner(`/orders/${so}/transition`), { to }, s)
    expect((await c.call('POST', c.owner(`/orders/${so}/transition`), { to: 'out_for_delivery' }, s)).json.error.code).toBe('INVALID_TRANSITION')
    expect((await c.call('POST', c.owner(`/orders/${so}/transition`), { to: 'delivered' }, s)).json.error.code).toBe('INVALID_TRANSITION')
  })

  it('rejecting needs a reason, returns the stock, and tells the customer why', async () => {
    const c = await boot()
    const token = c.guest()
    const before = (await c.call('GET', `/products/${TOOR}`)).json.data.hit.product.eligibility.sellableQty
    const o = (await c.placeOrder(token, [{ productId: TOOR, qty: 3 }])).json.data
    const so = o.storeOrders[0].id
    const s = await c.login(SELVAM)
    expect((await c.call('POST', c.owner(`/orders/${so}/transition`), { to: 'rejected' }, s)).json.error.code).toBe('REASON_REQUIRED')
    const r = await c.call('POST', c.owner(`/orders/${so}/transition`), { to: 'rejected', reason: 'Shop closed early today' }, s)
    expect(r.json.data.status).toBe('rejected')
    expect((await c.call('GET', `/products/${TOOR}`)).json.data.hit.product.eligibility.sellableQty).toBe(before)
    const seen = (await c.call('GET', `/orders/${o.id}`, undefined, null, { headers: { 'x-guest-token': token } })).json.data
    expect(seen.storeOrders[0]).toMatchObject({ status: 'rejected', rejectReason: 'Shop closed early today' })
    expect(seen.status).toBe('cancelled') // its only store said no
    expect((await c.call('POST', c.owner(`/orders/${so}/transition`), { to: 'accepted' }, s)).status).toBe(409)
  })

  it('a paid order that is rejected records a simulated refund', async () => {
    const c = await boot()
    const token = c.guest()
    const o = (await c.placeOrder(token, [{ productId: TOOR, qty: 1 }], 'upi_sim')).json.data
    await c.call('POST', `/orders/${o.id}/payment/simulate`, { outcome: 'success' }, null, { headers: { 'x-guest-token': token } })
    const s = await c.login(SELVAM)
    const r = await c.call('POST', c.owner(`/orders/${o.storeOrders[0].id}/transition`), { to: 'rejected', reason: 'Out of stock after all' }, s)
    expect(r.status).toBe(200)
    const seen = (await c.call('GET', `/orders/${o.id}`, undefined, null, { headers: { 'x-guest-token': token } })).json.data
    expect(seen.storeOrders[0].refundSimulatedPaise).toBe(o.storeOrders[0].totalPaise)
  })

  it('in a two-store order, one store rejecting does not cancel the other store\'s part', async () => {
    const c = await boot()
    const token = c.guest()
    const o = (await c.placeOrder(token, [{ productId: TOOR, qty: 1 }, { productId: pid('store-madhuram', 'Milk Bread'), qty: 1 }])).json.data
    const so = o.storeOrders.find((x: { store: { id: string } }) => x.store.id === SV).id
    const s = await c.login(SELVAM)
    await c.call('POST', c.owner(`/orders/${so}/transition`), { to: 'rejected', reason: 'Closed for a family event' }, s)
    const seen = (await c.call('GET', `/orders/${o.id}`, undefined, null, { headers: { 'x-guest-token': token } })).json.data
    expect(seen.status).toBe('confirmed')
    expect(seen.storeOrders.find((x: { store: { id: string } }) => x.store.id === 'store-madhuram').status).toBe('placed')
  })

  it('unpaid orders do not reach the store until payment completes', async () => {
    const c = await boot()
    const o = (await c.placeOrder(c.guest(), [{ productId: TOOR, qty: 1 }], 'upi_sim')).json.data
    const s = await c.login(SELVAM)
    expect((await c.call('GET', c.owner('/orders'), undefined, s)).json.data.some((x: { orderId: string }) => x.orderId === o.id)).toBe(false)
  })

  it('an owner cannot see or move another store\'s order, even through their own URL', async () => {
    const c = await boot()
    const o = (await c.placeOrder(c.guest(), [{ productId: TOOR, qty: 1 }])).json.data
    const m = await c.login(MARUTHAM)
    expect((await c.call('GET', '/owner/stores/store-marutham/orders', undefined, m)).json.data.some((x: { orderId: string }) => x.orderId === o.id)).toBe(false)
    expect((await c.call('POST', `/owner/stores/store-marutham/orders/${o.storeOrders[0].id}/transition`, { to: 'accepted' }, m)).status).toBe(404)
  })

  it('every step is in the store\'s audit trail', async () => {
    const c = await boot()
    const o = (await c.placeOrder(c.guest(), [{ productId: TOOR, qty: 1 }])).json.data
    const s = await c.login(SELVAM)
    await c.call('POST', c.owner(`/orders/${o.storeOrders[0].id}/transition`), { to: 'accepted' }, s)
    expect((await c.call('GET', c.owner('/audit'), undefined, s)).json.data[0]).toMatchObject({ action: 'order.accepted', entityId: o.storeOrders[0].id })
  })
})

/* ======================================================================= */
describe('audit trail', () => {
  it('is per store, newest first, and cannot be edited or deleted', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    await c.call('POST', c.owner(`/products/${TOOR}/flag`), { flagged: true, reason: 'supplier recall' }, s)
    await c.call('POST', c.owner(`/products/${TOOR}/flag`), { flagged: false, reason: 'recall cleared' }, s)
    const rows = (await c.call('GET', c.owner('/audit'), undefined, s)).json.data
    expect(rows.map((r: { action: string }) => r.action).slice(0, 2)).toEqual(['product.unflag', 'product.flag'])
    for (const m of ['PUT', 'PATCH', 'DELETE']) expect((await c.call(m, c.owner(`/audit/${rows[0].id}`), {}, s)).status).toBe(404)
    const m = await c.login(MARUTHAM)
    const theirs = (await c.call('GET', '/owner/stores/store-marutham/audit', undefined, m)).json.data
    expect(theirs.some((r: { entityId: string }) => r.entityId === TOOR)).toBe(false)
  })
})

/* ======================================================================= */
describe('product photos', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(64)])

  it('a real PNG is stored under a random name and shown to customers', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const r = await c.call('PUT', c.owner(`/products/${TOOR}/image`), undefined, s, { raw: png, headers: { 'content-type': 'image/png' } })
    expect(r.status).toBe(200)
    expect(r.json.data.product.imageUrl).toMatch(/^\/uploads\/[a-f0-9]{24}\.png$/)
    expect((await c.call('GET', `/products/${TOOR}`)).json.data.hit.product.imageUrl).toBe(r.json.data.product.imageUrl)
  })

  it('replacing a photo removes the old file', async () => {
    const c = await boot()
    const s = await c.login(SELVAM)
    await c.call('PUT', c.owner(`/products/${TOOR}/image`), undefined, s, { raw: png, headers: { 'content-type': 'image/png' } })
    await c.call('PUT', c.owner(`/products/${TOOR}/image`), undefined, s, { raw: png, headers: { 'content-type': 'image/png' } })
    expect(c.images.files.size).toBe(1)
  })

  it.each([
    ['an SVG (could carry script)', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/svg+xml', 415],
    ['bytes that are not what the header claims', Buffer.from('this is plainly not a jpeg file at all'), 'image/jpeg', 415],
    ['a PNG labelled as JPEG', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(16)]), 'image/jpeg', 415],
    ['a file over 1 MB', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(1024 * 1024 + 10)]), 'image/png', 413],
  ])('%s is refused', async (_n, raw, type, status) => {
    const c = await boot()
    const s = await c.login(SELVAM)
    const r = await c.call('PUT', c.owner(`/products/${TOOR}/image`), undefined, s, { raw, headers: { 'content-type': type } })
    expect(r.status).toBe(status)
    expect(c.images.files.size).toBe(0)
  })
})

/* ======================================================================= */
describe('dashboard and demo seed', () => {
  it('the dashboard adds up', async () => {
    const c = await boot()
    await c.placeOrder(c.guest(), [{ productId: TOOR, qty: 1 }])
    const s = await c.login(SELVAM)
    const d = (await c.call('GET', c.owner('/dashboard'), undefined, s)).json.data
    expect(d).toMatchObject({ ordersToday: 1, pendingOrders: 1 })
    expect(d.salesTodayPaise).toBeGreaterThan(0)
    expect(d.buckets.expired).toBeGreaterThanOrEqual(1)
    expect(d.buckets.invalid_expiry).toBeGreaterThanOrEqual(1)
    expect(d.unreadNotifications).toBeGreaterThan(0)
  })

  it('with demo seeding, stores start with orders in several states, through the real order flow', async () => {
    const c = await boot({ seedDemo: true })
    const s = await c.login(SELVAM)
    const statuses = (await c.call('GET', c.owner('/orders'), undefined, s)).json.data.map((o: { status: string }) => o.status)
    expect(statuses).toEqual(expect.arrayContaining(['placed', 'accepted', 'preparing']))
    expect((await c.call('GET', `/products/${TOOR}`)).json.data.hit.product.eligibility.sellableQty).toBe(38) // 40 − 2 seeded
  })
})
