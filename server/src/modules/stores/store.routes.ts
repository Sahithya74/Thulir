import { Router } from 'express'
import { z } from 'zod'
import { withDelivery } from '@thulir/shared'
import { AppError } from '../../middleware/errors.js'
import type { StoreRepository } from './store.repository.js'

const idParam = z.object({ id: z.string().min(1).max(64) })

// A customer location is optional; without it the server cannot compute delivery and says so.
const locationQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
})

function parseLocation(query: unknown) {
  const raw = query as Record<string, unknown>
  if (raw.lat === undefined && raw.lng === undefined) return null
  return locationQuery.parse(query)
}

export function storeRoutes(repo: StoreRepository): Router {
  const r = Router()

  /** GET /stores?lat=&lng= — each store carries `delivery` (distance, ETA, deliverable) for that location. */
  r.get('/', async (req, res) => {
    const loc = parseLocation(req.query)
    const stores = await repo.list()
    res.json({
      data: loc ? stores.map((s) => withDelivery(s, loc)) : stores,
      meta: { deliveryComputed: Boolean(loc), simulated: true },
    })
  })

  r.get('/:id', async (req, res) => {
    const { id } = idParam.parse(req.params)
    const loc = parseLocation(req.query)
    const store = await repo.findById(id)
    if (!store) throw new AppError(404, 'STORE_NOT_FOUND', 'Store not found')
    res.json({ data: loc ? withDelivery(store, loc) : store, meta: { deliveryComputed: Boolean(loc), simulated: true } })
  })

  return r
}
