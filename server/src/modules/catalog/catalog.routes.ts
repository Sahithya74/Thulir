import { Router } from 'express'
import { z } from 'zod'
import { createCatalogService, withDeliveryAll } from '@thulir/shared'
import { AppError } from '../../middleware/errors.js'
import type { StoreRepository } from '../stores/store.repository.js'
import type { CatalogRepository } from './catalog.repository.js'

const id = z.string().min(1).max(64)
const searchQuery = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  storeId: id.optional(),
})
const suggestQuery = z.object({ q: z.string().trim().min(1).max(40) })
const location = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
})

/**
 * Customer-facing catalog. A fresh CatalogService is built per request against the current clock, so freshness and
 * eligibility are re-validated on every fetch — nothing is cached across requests, and a product that expires at
 * midnight disappears at midnight. Internal fields (reasons, batches, owner flags) are never serialised here.
 */
export function catalogRoutes(
  repo: StoreRepository,
  catalog: CatalogRepository,
  clock: () => Date = () => new Date(),
): Router {
  const r = Router()
  const service = async () => createCatalogService(await repo.list(), clock(), catalog.snapshot(), (id) => catalog.overridesFor(id))

  r.get('/stores/:id/catalog', async (req, res) => {
    const storeId = id.parse(req.params.id)
    const catalog = (await service()).storeCatalog(storeId)
    if (!catalog) throw new AppError(404, 'STORE_NOT_FOUND', 'Store not found')
    res.json({ data: catalog })
  })

  r.get('/products/:id', async (req, res) => {
    const detail = (await service()).product(id.parse(req.params.id))
    // Unknown and ineligible products are deliberately indistinguishable.
    if (!detail) throw new AppError(404, 'PRODUCT_NOT_AVAILABLE', 'This product is not available')
    res.json({ data: detail })
  })

  r.get('/search', async (req, res) => {
    const { q, limit, storeId } = searchQuery.parse(req.query)
    res.json({ data: (await service()).search(q, { limit, storeId }) })
  })

  r.get('/search/suggest', async (req, res) => {
    const { q } = suggestQuery.parse(req.query)
    res.json({ data: (await service()).suggest(q) })
  })

  r.get('/search/popular', async (_req, res) => {
    // Simulated: a fixed list. Real popularity needs order history (later phases).
    res.json({ data: (await service()).popular(), meta: { simulated: true } })
  })

  r.get('/missions', async (_req, res) => {
    res.json({ data: (await service()).missions() })
  })

  r.get('/missions/:id', async (req, res) => {
    const loc = location.parse(req.query)
    const stores = withDeliveryAll(await repo.list(), loc)
    const result = (await service()).mission(id.parse(req.params.id), stores)
    if (!result) throw new AppError(404, 'MISSION_NOT_FOUND', 'Mission not found')
    res.json({ data: result })
  })

  return r
}
