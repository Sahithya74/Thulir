import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildDemoCatalog, createCatalogService, demoStores } from '@thulir/shared'
import { createApp } from './app.js'

const START = new Date('2026-06-10T06:30:00Z') // 12:00 IST
let now = START
let server: Server
let base = ''

beforeAll(async () => {
  const app = createApp({ clock: () => now })
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve())
  })
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`
})
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const get = async (path: string): Promise<{ status: number; text: string; json: any }> => {
  const res = await fetch(base + path)
  const text = await res.text()
  return { status: res.status, text, json: JSON.parse(text) }
}

// Products the freshness rules must keep away from customers, computed independently from the shared logic.
const verdicts = createCatalogService(demoStores, START, buildDemoCatalog(START)).verdicts()
const hiddenIds = verdicts
  .filter((v) => !(v.eligibility.sellable || v.eligibility.status === 'out_of_stock'))
  .map((v) => v.product.id)

describe('catalog API: server-side freshness enforcement', () => {
  it('there are hidden products to test against', () => {
    expect(hiddenIds.length).toBeGreaterThanOrEqual(6)
  })

  it('catalog omits ineligible products and reports only a count', async () => {
    let hiddenTotal = 0
    for (const s of demoStores) {
      const { status, json } = await get(`/stores/${s.id}/catalog`)
      expect(status).toBe(200)
      const ids: string[] = json.data.products.map((p: { id: string }) => p.id)
      for (const h of hiddenIds) expect(ids).not.toContain(h)
      hiddenTotal += json.data.hiddenCount
    }
    expect(hiddenTotal).toBe(hiddenIds.length)
  })

  it('fetching a hidden product directly is a 404, identical to an unknown product', async () => {
    const unknown = await get('/products/does-not-exist')
    for (const h of hiddenIds) {
      const r = await get(`/products/${h}`)
      expect(r.status).toBe(404)
      expect(r.json).toEqual(unknown.json)
    }
  })

  it('search cannot surface a hidden product, even by its exact name', async () => {
    for (const h of hiddenIds) {
      const name = verdicts.find((v) => v.product.id === h)!.product.name.en
      const r = await get(`/search?q=${encodeURIComponent(name)}&limit=60`)
      expect(r.json.data.map((x: { product: { id: string } }) => x.product.id)).not.toContain(h)
    }
  })

  it('never serialises internal fields', async () => {
    const r = await get('/stores/store-marutham/catalog')
    for (const word of ['flaggedForRemoval', 'requiresExpiry', 'policyOverride', 'reasons', 'batchNo', 'EXPIRED_BATCH', 'NEAR_EXPIRY_NOT_SOLD']) {
      expect(r.text).not.toContain(word)
    }
  })

  it('re-validates against the live clock: stock expires while the server is running', async () => {
    const id = 'mm-13' // a snack with its only batch ~4 days out
    expect((await get(`/products/${id}`)).status).toBe(200)
    now = new Date(START.getTime() + 5 * 86_400_000)
    try {
      expect((await get(`/products/${id}`)).status).toBe(404)
      const cat = await get('/stores/store-marutham/catalog')
      expect(cat.json.data.products.map((p: { id: string }) => p.id)).not.toContain(id)
    } finally {
      now = START
    }
  })
})

describe('catalog API: validation and shape', () => {
  it('rejects bad search input with a uniform error', async () => {
    for (const q of ['/search', '/search?q=', `/search?q=${'x'.repeat(200)}`, '/search?q=rice&limit=999', '/search?q=rice&limit=abc']) {
      const r = await get(q)
      expect(r.status, q).toBe(400)
      expect(r.json.error.code).toBe('VALIDATION_FAILED')
    }
  })
  it('unknown store catalog is 404', async () => {
    expect((await get('/stores/nope/catalog')).status).toBe(404)
  })
  it('suggest and popular work', async () => {
    const s = await get('/search/suggest?q=to')
    expect(s.status).toBe(200)
    expect(s.json.data.length).toBeGreaterThan(0)
    expect((await get('/search/popular')).json.meta.simulated).toBe(true)
  })
  it('missions list has all eight; a mission needs a location', async () => {
    expect((await get('/missions')).json.data).toHaveLength(8)
    expect((await get('/missions/weekly-essentials')).status).toBe(400)
    const ok = await get('/missions/weekly-essentials?lat=11.2&lng=78.15')
    expect(ok.status).toBe(200)
    expect(ok.json.data.groups.length).toBeGreaterThan(0)
    expect((await get('/missions/nope?lat=11.2&lng=78.15')).status).toBe(404)
  })
  it('product detail includes sellable substitutes and the store it comes from', async () => {
    const r = await get('/products/mm-03')
    expect(r.status).toBe(200)
    expect(r.json.data.hit.store.slug).toBe('marutham-super-mart')
    for (const s of r.json.data.substitutes) expect(s.product.eligibility.sellable).toBe(true)
  })
})
