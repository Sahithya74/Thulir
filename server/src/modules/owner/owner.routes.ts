import express, { Router } from 'express'
import { z } from 'zod'
import {
  OWNER_BUCKET_ORDER,
  istDate,
  type AuditEntryView,
  type OwnerBucket,
  type OwnerDashboardData,
  type OwnerProductRow,
} from '@thulir/shared'
import { AppError } from '../../middleware/errors.js'
import { authenticate, requireCsrf, requireRole, requireStoreAccess } from '../../middleware/auth.js'
import type { AuditLog, AuditRecord } from '../audit/audit.repository.js'
import type { AuthService } from '../auth/auth.service.js'
import type { ExpiryService } from '../expiry/expiry.service.js'
import type { Actor, InventoryService } from '../inventory/inventory.service.js'
import type { NotificationService } from '../notifications/notification.service.js'
import type { OrderService } from '../orders/order.service.js'
import { IMAGE_MIME, MAX_IMAGE_BYTES, sniffImage, type ImageStorage } from '../../services/imageStorage.js'

const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
const text = (min: number, max: number) => z.string().transform(clean).pipe(z.string().min(min).max(max))
const dept = z.enum(['fresh', 'pantry', 'chilled', 'household', 'personal_care', 'snacks', 'beverages', 'bakery'])
const shape = z.enum(['box', 'bottle', 'pouch', 'jar', 'crate', 'carton', 'tub', 'bar'])
const isoDate = z.string().max(10)

const batchInput = z.object({ batchNo: z.string().min(1).max(30), qty: z.number(), expiryDate: isoDate.nullable().optional() }).strict()

const productInput = z
  .object({
    name: z.object({ en: text(2, 80), ta: text(0, 80).default('') }).strict(),
    brand: text(1, 40),
    department: dept,
    unit: text(1, 20),
    pricePaise: z.number(),
    mrpPaise: z.number(),
    description: text(0, 300).default(''),
    shape,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    tags: z.array(z.string().regex(/^[a-z0-9]{1,20}$/)).max(8).default([]),
    veg: z.boolean(),
    requiresExpiry: z.boolean(),
    initialBatch: batchInput.optional(),
  })
  .strict()

const productPatch = z
  .object({
    name: z.object({ en: text(2, 80), ta: text(0, 80).default('') }).strict().optional(),
    brand: text(1, 40).optional(),
    department: dept.optional(),
    unit: text(1, 20).optional(),
    pricePaise: z.number().optional(),
    mrpPaise: z.number().optional(),
    description: text(0, 300).optional(),
    shape: shape.optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    tags: z.array(z.string().regex(/^[a-z0-9]{1,20}$/)).max(8).optional(),
    veg: z.boolean().optional(),
    requiresExpiry: z.boolean().optional(), // accepted only so the service can refuse it with a clear message
    reason: text(0, 300).optional(),
  })
  .strict()

const reason = text(0, 300).optional()
const ids = z.object({ storeId: z.string().max(64), pid: z.string().max(64).optional(), bid: z.string().max(80).optional(), soid: z.string().max(40).optional(), nid: z.string().max(40).optional(), department: dept.optional() })

const inventoryQuery = z.object({ q: z.string().max(60).optional(), status: z.string().max(20).optional(), department: dept.optional(), bucket: z.string().max(20).optional() })

const auditView = (a: AuditRecord): AuditEntryView => ({
  id: a.id, at: a.at, actorName: a.actorName, actorRole: a.actorRole, action: a.action, entityType: a.entityType, entityId: a.entityId, summary: a.summary, reason: a.reason, before: a.before, after: a.after,
})

interface Deps {
  auth: AuthService
  inventory: InventoryService
  expiry: ExpiryService
  orders: OrderService
  notifications: NotificationService
  audit: AuditLog
  images: ImageStorage
  clock: () => Date
}

export function ownerRoutes({ auth, inventory, expiry, orders, notifications, audit, images, clock }: Deps): Router {
  const r = Router({ mergeParams: true })
  // Every owner endpoint: signed in → is a store owner → owns THIS store → passes the CSRF check on writes.
  r.use(authenticate(auth), requireRole('store_owner'))
  const store = Router({ mergeParams: true })
  store.use(requireCsrf)

  const actor = (res: express.Response): Actor => {
    const u = res.locals.user!
    return { id: u.id, name: u.name, role: u.role }
  }
  const p = (req: express.Request) => ids.parse(req.params)

  /* ------------------------------------------------------------- dashboard */
  store.get('/dashboard', async (req, res) => {
    const { storeId } = p(req)
    const now = clock()
    const today = istDate(now)
    const rows = await expiry.ownerRows(storeId, now)
    const all = orders.listForStore(storeId)
    const todays = all.filter((o) => istDate(new Date(o.createdAt)) === today)
    const buckets = Object.fromEntries(OWNER_BUCKET_ORDER.map((b) => [b, 0])) as Record<OwnerBucket, number>
    for (const row of rows) for (const b of row.buckets) buckets[b]++
    const data: OwnerDashboardData = {
      ordersToday: todays.length,
      pendingOrders: all.filter((o) => o.status === 'placed').length,
      inProgressOrders: all.filter((o) => ['accepted', 'preparing', 'ready'].includes(o.status)).length,
      completedOrders: all.filter((o) => ['handed_over', 'out_for_delivery', 'delivered'].includes(o.status)).length,
      salesTodayPaise: todays.filter((o) => o.status !== 'rejected' && o.status !== 'cancelled').reduce((n, o) => n + o.totalPaise, 0),
      activeProducts: rows.filter((x) => x.eligibility.sellable).length,
      outOfStock: rows.filter((x) => x.status === 'out_of_stock').length,
      lowStock: rows.filter((x) => x.status === 'low_stock').length,
      buckets,
      unreadNotifications: notifications.unreadCount(storeId),
      recent: audit.listByStore(storeId, 8).map(auditView),
    }
    res.json({ data })
  })

  /* ------------------------------------------------------------- inventory */
  store.get('/inventory', async (req, res) => {
    const { storeId } = p(req)
    const q = inventoryQuery.parse(req.query)
    let rows: OwnerProductRow[] = await inventory.list(storeId)
    const needle = q.q?.toLowerCase().trim()
    if (needle) rows = rows.filter((x) => [x.product.name.en, x.product.name.ta, x.product.brand, ...x.product.aliases].join(' ').toLowerCase().includes(needle))
    if (q.status) rows = rows.filter((x) => x.status === q.status)
    if (q.department) rows = rows.filter((x) => x.product.department === q.department)
    if (q.bucket) rows = rows.filter((x) => (x.buckets as string[]).includes(q.bucket!))
    res.json({ data: rows })
  })

  store.get('/products/:pid', async (req, res) => {
    const { storeId, pid } = p(req)
    res.json({ data: await inventory.get(storeId, pid!) })
  })

  store.post('/products', async (req, res) => {
    const { storeId } = p(req)
    res.status(201).json({ data: await inventory.createProduct(storeId, actor(res), productInput.parse(req.body)) })
  })

  store.patch('/products/:pid', async (req, res) => {
    const { storeId, pid } = p(req)
    const { reason: why, ...patch } = productPatch.parse(req.body)
    res.json({ data: await inventory.updateProduct(storeId, pid!, actor(res), patch, why) })
  })

  store.post('/products/:pid/availability', async (req, res) => {
    const { storeId, pid } = p(req)
    const b = z.object({ available: z.boolean(), reason }).strict().parse(req.body)
    res.json({ data: await inventory.setAvailability(storeId, pid!, actor(res), b.available, b.reason) })
  })

  store.post('/products/:pid/flag', async (req, res) => {
    const { storeId, pid } = p(req)
    const b = z.object({ flagged: z.boolean(), reason }).strict().parse(req.body)
    res.json({ data: await inventory.setFlag(storeId, pid!, actor(res), b.flagged, b.reason) })
  })

  store.post('/products/:pid/batches', async (req, res) => {
    const { storeId, pid } = p(req)
    res.status(201).json({ data: await inventory.receiveBatch(storeId, pid!, actor(res), batchInput.parse(req.body)) })
  })

  store.patch('/products/:pid/batches/:bid/qty', async (req, res) => {
    const { storeId, pid, bid } = p(req)
    const b = z.object({ delta: z.number(), reason }).strict().parse(req.body)
    res.json({ data: await inventory.adjustQty(storeId, pid!, bid!, actor(res), b.delta, b.reason) })
  })

  store.patch('/products/:pid/batches/:bid/expiry', async (req, res) => {
    const { storeId, pid, bid } = p(req)
    const b = z.object({ expiryDate: isoDate, reason }).strict().parse(req.body)
    res.json({ data: await inventory.correctExpiry(storeId, pid!, bid!, actor(res), b.expiryDate, b.reason) })
  })

  store.post('/products/:pid/batches/:bid/status', async (req, res) => {
    const { storeId, pid, bid } = p(req)
    const b = z.object({ status: z.enum(['active', 'blocked', 'removed']), reason }).strict().parse(req.body)
    res.json({ data: await inventory.setBatchStatus(storeId, pid!, bid!, actor(res), b.status, b.reason) })
  })

  store.put('/products/:pid/image', express.raw({ type: Object.values(IMAGE_MIME), limit: MAX_IMAGE_BYTES }), async (req, res) => {
    const { storeId, pid } = p(req)
    await inventory.get(storeId, pid!) // 404 for a product that is not this store's, before touching storage
    const buf = req.body as unknown
    if (!Buffer.isBuffer(buf) || buf.length === 0) throw new AppError(415, 'UNSUPPORTED_MEDIA', 'Upload a PNG, JPEG or WebP image (up to 1 MB).')
    const ext = sniffImage(buf)
    // The declared type must agree with the actual bytes.
    if (!ext || IMAGE_MIME[ext] !== req.header('content-type')) throw new AppError(415, 'UNSUPPORTED_MEDIA', 'That file is not a valid PNG, JPEG or WebP image.')
    const url = await images.save(buf, ext)
    const { row, previous } = await inventory.setImage(storeId, pid!, actor(res), url)
    if (previous) await images.remove(previous)
    res.json({ data: row })
  })

  /* ---------------------------------------------------------------- expiry */
  store.get('/expiry', async (req, res) => {
    const { storeId } = p(req)
    const rows = await expiry.ownerRows(storeId, clock())
    const buckets = Object.fromEntries(OWNER_BUCKET_ORDER.map((b) => [b, rows.filter((x) => x.buckets.includes(b))])) as Record<OwnerBucket, OwnerProductRow[]>
    res.json({ data: { order: OWNER_BUCKET_ORDER, buckets } })
  })

  store.post('/expiry/scan', async (req, res) => {
    const { storeId } = p(req)
    res.json({ data: { created: await expiry.scanStore(storeId, clock()) } })
  })

  /* -------------------------------------------------------------- policies */
  store.get('/policies', (req, res) => {
    res.json({ data: inventory.policies(p(req).storeId) })
  })

  store.put('/policies/:department', async (req, res) => {
    const { storeId, department } = p(req)
    const b = z
      .object({ nearExpiryDays: z.number().optional(), lowStockAt: z.number().optional(), sellNearExpiry: z.boolean().optional(), blockOnExpiryDay: z.boolean().optional(), reason })
      .strict()
      .parse(req.body)
    const { reason: why, ...patch } = b
    res.json({ data: await inventory.setPolicy(storeId, department!, actor(res), patch, why) })
  })

  /* ---------------------------------------------------------------- orders */
  store.get('/orders', (req, res) => {
    res.json({ data: orders.listForStore(p(req).storeId) })
  })

  store.post('/orders/:soid/transition', (req, res) => {
    const { storeId, soid } = p(req)
    const b = z
      .object({ to: z.enum(['accepted', 'rejected', 'preparing', 'ready', 'handed_over', 'out_for_delivery', 'delivered', 'cancelled', 'placed']), reason })
      .strict()
      .parse(req.body)
    // The portal acts as "store". Whether this step is allowed is decided by the shared state machine, not here.
    res.json({ data: orders.transition({ storeId, storeOrderId: soid!, to: b.to, as: 'store', actor: actor(res), reason: b.reason }) })
  })

  /* ---------------------------------------------------------- notifications */
  store.get('/notifications', (req, res) => {
    const { storeId } = p(req)
    res.json({
      data: notifications.list(storeId),
      meta: { unread: notifications.unreadCount(storeId), channelNote: 'In-app only. Email, SMS and WhatsApp are not connected in this prototype.' },
    })
  })

  store.post('/notifications/read-all', (req, res) => {
    res.json({ data: { marked: notifications.markAllRead(p(req).storeId, clock()) } })
  })

  store.post('/notifications/:nid/read', (req, res) => {
    const { storeId, nid } = p(req)
    if (!notifications.markRead(storeId, nid!, clock())) throw new AppError(404, 'NOT_FOUND', 'Notification not found')
    res.json({ data: { ok: true } })
  })

  /* ----------------------------------------------------------------- audit */
  store.get('/audit', (req, res) => {
    const { storeId } = p(req)
    const limit = z.coerce.number().int().min(1).max(200).catch(50).parse(req.query.limit)
    res.json({ data: audit.listByStore(storeId, limit).map(auditView) })
  })

  r.use('/stores/:storeId', requireStoreAccess('storeId'), store)
  return r
}
