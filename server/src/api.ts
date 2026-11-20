import { Router } from 'express'
import { InMemoryAuditLog } from './modules/audit/audit.repository.js'
import { adminRoutes } from './modules/admin/admin.routes.js'
import { buildDemoUsers } from './modules/auth/demoUsers.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { createAuthService } from './modules/auth/auth.service.js'
import { InMemoryUserRepository } from './modules/auth/users.repository.js'
import { cartRoutes } from './modules/cart/cart.routes.js'
import { InMemoryCatalogRepository } from './modules/catalog/catalog.repository.js'
import { catalogRoutes } from './modules/catalog/catalog.routes.js'
import { deliveryRoutes } from './modules/delivery/delivery.routes.js'
import { createExpiryService } from './modules/expiry/expiry.service.js'
import { createInventoryService } from './modules/inventory/inventory.service.js'
import { locationRoutes } from './modules/locations/location.routes.js'
import { createNotificationService } from './modules/notifications/notification.service.js'
import { InMemoryOrderRepository } from './modules/orders/order.repository.js'
import { orderRoutes } from './modules/orders/order.routes.js'
import { createOrderService } from './modules/orders/order.service.js'
import { ownerRoutes } from './modules/owner/owner.routes.js'
import { createPaymentService } from './modules/payments/payment.service.js'
import { InMemoryStoreRepository } from './modules/stores/store.repository.js'
import { storeRoutes } from './modules/stores/store.routes.js'
import { seedDemoOrders } from './seed.js'
import type { ImageStorage } from './services/imageStorage.js'

export interface ApiOptions {
  clock: () => Date
  rateLimits?: { orderCreatePerMinute?: number; cartValidatePerMinute?: number; loginPerMinute?: number }
  jwtSecret: string
  bcryptCost: number
  secureCookies: boolean
  images: ImageStorage
  seedDemo?: boolean
  /** Shown by /health: where the data lives ("memory", or "browser" for the static demo). */
  runtime: string
}

export interface Api {
  /** Everything under /api/v1. */
  router: Router
  /** Resolves once start-up work (demo seed, first freshness scan) has finished. */
  ready: Promise<void>
  /** Re-scan stock freshness and raise owner alerts. */
  sweep(): Promise<void>
}

/**
 * Wires the services and mounts every route. It has no Node-only dependencies of its own, so the same wiring runs in
 * the Node server (app.ts) and inside the browser for the static GitHub Pages demo (browser/staticApi.ts).
 */
export function createApi(opts: ApiOptions): Api {
  const { clock } = opts
  const stores = new InMemoryStoreRepository()
  const catalog = new InMemoryCatalogRepository(clock())
  const audit = new InMemoryAuditLog()
  const notifications = createNotificationService()
  const payments = createPaymentService()
  const images = opts.images
  const expiry = createExpiryService({ stores, catalog, notifications, clock })
  const inventory = createInventoryService({ catalog, audit, expiry, clock })
  const users = new InMemoryUserRepository(buildDemoUsers(opts.bcryptCost))
  const auth = createAuthService(users, opts.jwtSecret, opts.bcryptCost)

  const orders = createOrderService({
    stores,
    catalog,
    orders: new InMemoryOrderRepository(),
    payments,
    audit,
    clock,
    // Prototype dispatch: the first available partner. Real dispatch (distance, load, shifts) is future work.
    assignPartner: () => {
      const p = users.byRole('delivery_partner')[0]
      return p ? { id: p.id, name: p.name } : null
    },
    // Tell each store when a real order arrives.
    onConfirmed: (o) => {
      const now = clock()
      const label = payments.info(o.payment.method).label
      for (const so of o.storeOrders) {
        const n = so.items.reduce((c, i) => c + i.qty, 0)
        notifications.send(
          { storeId: so.storeId, kind: 'order', severity: 'info', title: `New order ${so.id}`, body: `${n} item${n === 1 ? '' : 's'} · ₹${(so.totalPaise / 100).toLocaleString('en-IN')} · ${label}`, orderId: o.id, dedupeKey: `order:${so.id}` },
          now,
        )
      }
    },
  })

  const api = Router()
  api.get('/health', (_req, res) => {
    res.json({ data: { status: 'ok', service: 'thulir-server', db: opts.runtime, demo: true } })
  })
  api.use('/stores', storeRoutes(stores))
  api.use(catalogRoutes(stores, catalog, clock))
  api.use('/locations', locationRoutes())
  api.use('/cart', cartRoutes(stores, catalog, clock, opts.rateLimits?.cartValidatePerMinute ?? 120))
  api.get('/payments/methods', (_req, res) => {
    res.json({ data: payments.methods(), meta: { note: 'Every payment method in this prototype is a demo. No real money moves.' } })
  })
  api.use('/orders', orderRoutes(orders, { createPerMinute: opts.rateLimits?.orderCreatePerMinute ?? 10 }))
  api.use('/auth', authRoutes(auth, { secureCookies: opts.secureCookies, loginPerMinute: opts.rateLimits?.loginPerMinute ?? 8, audit, clock }))
  api.use('/owner', ownerRoutes({ auth, inventory, expiry, orders, notifications, audit, images, clock }))
  api.use('/delivery', deliveryRoutes(auth, orders))
  api.use('/admin', adminRoutes({ auth, stores, catalog, orders, expiry, audit, clock }))

  const ready = (async () => {
    if (opts.seedDemo) await seedDemoOrders(orders, {})
    await expiry.scanAll(clock())
  })()

  return { router: api, ready, sweep: () => expiry.scanAll(clock()).then(() => undefined) }
}
