import { Router } from 'express'
import { z } from 'zod'
import { createCatalogService, withDeliveryAll } from '@thulir/shared'
import { rateLimit } from '../../middleware/rateLimit.js'
import type { CatalogRepository } from '../catalog/catalog.repository.js'
import type { StoreRepository } from '../stores/store.repository.js'

const body = z
  .object({
    lines: z.array(z.object({ productId: z.string().min(1).max(64), qty: z.number() }).strict()).max(60),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict()

/**
 * The basket lives in the customer's browser; the server is stateless about it and re-prices and re-validates it every
 * time it is asked. The client sends product ids and quantities only — never prices — and receives the full verdict.
 */
export function cartRoutes(stores: StoreRepository, catalog: CatalogRepository, clock: () => Date, perMinute: number): Router {
  const r = Router()
  r.post('/validate', rateLimit({ windowMs: 60_000, max: perMinute, key: (req) => req.ip ?? 'unknown' }), async (req, res) => {
    const { lines, lat, lng } = body.parse(req.body)
    const all = await stores.list()
    const now = clock()
    const svc = createCatalogService(all, now, catalog.snapshot(), (id) => catalog.overridesFor(id))
    res.json({ data: svc.cart(lines, withDeliveryAll(all, { lat, lng })) })
  })
  return r
}
