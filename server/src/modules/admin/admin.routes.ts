import { Router } from 'express'
import { z } from 'zod'
import type {
  AdminAnalytics,
  AdminComplianceRow,
  AdminStoreRow,
  AuditEntryView,
  Department,
  ExpiryPolicy,
  StoreOrderStatus,
} from '@thulir/shared'
import { AppError } from '../../middleware/errors.js'
import { authenticate, requireCsrf, requireRole } from '../../middleware/auth.js'
import type { AuditLog } from '../audit/audit.repository.js'
import type { AuthService } from '../auth/auth.service.js'
import type { CatalogRepository } from '../catalog/catalog.repository.js'
import type { ExpiryService } from '../expiry/expiry.service.js'
import type { OrderService } from '../orders/order.service.js'
import type { StoreRepository } from '../stores/store.repository.js'

const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
const reason = z.string().transform(clean).pipe(z.string().min(5, 'Please give a reason (at least 5 characters).').max(300))
const dept = z.enum(['fresh', 'pantry', 'chilled', 'household', 'personal_care', 'snacks', 'beverages', 'bakery'])

interface Deps {
  auth: AuthService
  stores: StoreRepository
  catalog: CatalogRepository
  orders: OrderService
  expiry: ExpiryService
  audit: AuditLog
  clock: () => Date
}

const DONE_BAD: StoreOrderStatus[] = ['rejected', 'cancelled']

/**
 * Platform admin API. Admins see across stores, but every change they make needs a reason and lands in the audit log.
 * They cannot edit stock directly: stock is changed only through the owner's audited inventory actions.
 */
export function adminRoutes({ auth, stores, catalog, orders, expiry, audit, clock }: Deps): Router {
  const r = Router()
  r.use(authenticate(auth), requireRole('admin'), requireCsrf)
  const actor = (u: { id: string; name: string; role: 'admin' }) => ({ actorId: u.id, actorName: u.name, actorRole: u.role })

  async function storeRows(): Promise<AdminStoreRow[]> {
    const all = await stores.listAll()
    const orderRows = orders.listForAdmin()
    return Promise.all(
      all.map(async (s) => {
        const rows = await expiry.ownerRows(s.id, clock())
        const mine = orderRows.filter((o) => o.storeId === s.id)
        return {
          id: s.id,
          name: s.name,
          category: s.category,
          status: s.status ?? 'active',
          verification: s.verification,
          isDemo: s.isDemo,
          products: rows.length,
          sellable: rows.filter((x) => x.eligibility.sellable).length,
          hidden: rows.filter((x) => !x.eligibility.sellable && x.status !== 'out_of_stock').length,
          expiredOrBlocked: rows.filter((x) => x.status === 'expired' || x.status === 'blocked').length,
          orders: mine.length,
          activeOrders: mine.filter((o) => !['delivered', ...DONE_BAD].includes(o.status)).length,
        }
      }),
    )
  }

  r.get('/stores', async (_req, res) => {
    res.json({ data: await storeRows() })
  })

  r.post('/stores/:id/status', async (req, res) => {
    const id = z.string().max(64).parse(req.params.id)
    const b = z.object({ status: z.enum(['active', 'suspended']), reason }).strict().parse(req.body)
    const before = await stores.findAny(id)
    if (!before) throw new AppError(404, 'STORE_NOT_FOUND', 'Store not found')
    const was = before.status ?? 'active'
    await stores.setStatus(id, b.status)
    audit.append(
      { ...actor(res.locals.user as { id: string; name: string; role: 'admin' }), storeId: id, action: b.status === 'suspended' ? 'store.suspend' : 'store.reinstate', entityType: 'store', entityId: id, summary: `${b.status === 'suspended' ? 'Suspended' : 'Reinstated'} ${before.name.en}`, reason: b.reason, before: { status: was }, after: { status: b.status } },
      clock(),
    )
    res.json({ data: (await storeRows()).find((x) => x.id === id) })
  })

  r.get('/orders', (_req, res) => {
    res.json({ data: orders.listForAdmin() })
  })

  r.post('/orders/:soid/cancel', (req, res) => {
    const soid = z.string().max(40).parse(req.params.soid)
    const b = z.object({ reason }).strict().parse(req.body)
    const u = res.locals.user!
    orders.transition({ storeOrderId: soid, to: 'cancelled', as: 'admin', actor: { id: u.id, name: u.name, role: u.role }, reason: b.reason })
    res.json({ data: orders.listForAdmin().find((o) => o.storeOrderId === soid) })
  })

  r.get('/compliance', async (_req, res) => {
    const out: AdminComplianceRow[] = []
    for (const s of await stores.listAll()) {
      for (const row of await expiry.ownerRows(s.id, clock())) {
        if (row.eligibility.sellable || row.status === 'out_of_stock') continue
        out.push({ storeId: s.id, storeName: s.name, productId: row.product.id, productName: row.product.name.en, status: row.status, reasons: row.eligibility.reasons })
      }
    }
    res.json({ data: out })
  })

  r.get('/analytics', async (_req, res) => {
    const all = await stores.listAll()
    const rows = orders.listForAdmin()
    const byStatus: Partial<Record<StoreOrderStatus, number>> = {}
    for (const o of rows) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
    const live = rows.filter((o) => !DONE_BAD.includes(o.status))
    let products = 0
    let sellable = 0
    let hidden = 0
    for (const s of all) {
      for (const row of await expiry.ownerRows(s.id, clock())) {
        products++
        if (row.eligibility.sellable) sellable++
        else if (row.status !== 'out_of_stock') hidden++
      }
    }
    const data: AdminAnalytics = {
      stores: { total: all.length, active: all.filter((s) => (s.status ?? 'active') === 'active').length, suspended: all.filter((s) => s.status === 'suspended').length },
      orders: { total: rows.length, byStatus, cancelledOrRejected: rows.length - live.length },
      gmvPaise: live.reduce((n, o) => n + o.totalPaise, 0),
      freshness: { products, sellable, hiddenByChecks: hidden, compliancePercent: products ? Math.round((sellable / products) * 100) : 100 },
      perStore: all.map((s) => ({ storeId: s.id, name: s.name, orders: rows.filter((o) => o.storeId === s.id).length, gmvPaise: live.filter((o) => o.storeId === s.id).reduce((n, o) => n + o.totalPaise, 0) })),
    }
    res.json({ data })
  })

  r.get('/policies', (_req, res) => {
    res.json({ data: { departments: catalog.platformPolicies() } })
  })

  r.put('/policies/:department', async (req, res) => {
    const d = dept.parse(req.params.department) as Department
    const b = z
      .object({ nearExpiryDays: z.number().int().min(0).max(90).optional(), lowStockAt: z.number().int().min(0).max(100).optional(), sellNearExpiry: z.boolean().optional(), blockOnExpiryDay: z.boolean().optional(), reason })
      .strict()
      .parse(req.body)
    const { reason: why, ...patch } = b
    if (Object.keys(patch).length === 0) throw new AppError(422, 'INVALID_POLICY', 'Nothing to change.')
    const before = catalog.platformPolicies()[d] ?? null
    catalog.setPlatformPolicy(d, patch as Partial<ExpiryPolicy>)
    audit.append(
      { ...actor(res.locals.user as { id: string; name: string; role: 'admin' }), storeId: null, action: 'platform.policy', entityType: 'policy', entityId: `platform:${d}`, summary: `Changed platform freshness defaults for ${d.replace('_', ' ')}`, reason: why, before, after: patch },
      clock(),
    )
    await expiry.scanAll(clock())
    res.json({ data: { departments: catalog.platformPolicies() } })
  })

  r.get('/audit', (req, res) => {
    const q = z.object({ storeId: z.string().max(64).optional(), limit: z.coerce.number().int().min(1).max(500).catch(200) }).parse(req.query)
    const rows = [...audit.all()].reverse().filter((a) => !q.storeId || a.storeId === q.storeId).slice(0, q.limit)
    const view: (AuditEntryView & { storeId: string | null })[] = rows.map((a) => ({ id: a.id, at: a.at, actorName: a.actorName, actorRole: a.actorRole, action: a.action, entityType: a.entityType, entityId: a.entityId, summary: a.summary, reason: a.reason, before: a.before, after: a.after, storeId: a.storeId }))
    res.json({ data: view })
  })

  return r
}
