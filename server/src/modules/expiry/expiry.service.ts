import {
  bucketsFor,
  classifyBatch,
  createCatalogService,
  daysBetween,
  istDate,
  type Batch,
  type ExpiryPolicy,
  type NotificationSeverity,
  type OwnerBatchRow,
  type OwnerBucket,
  type OwnerProductRow,
  type Product,
} from '@thulir/shared'
import type { CatalogRepository } from '../catalog/catalog.repository.js'
import type { NotificationService } from '../notifications/notification.service.js'
import type { StoreRepository } from '../stores/store.repository.js'

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
const units = (n: number) => `${n} unit${n === 1 ? '' : 's'}`

export interface Problem {
  bucket: OwnerBucket | 'low_stock'
  severity: NotificationSeverity
  title: string
  body: string
  /** Identifies this exact situation, so it is announced once. A new batch or a corrected date is a new situation. */
  signature: string
}

/** Per-batch view of how the engine sees each batch right now. */
export function batchRows(product: Product, batches: Batch[], policy: ExpiryPolicy, now: Date): OwnerBatchRow[] {
  const today = istDate(now)
  return batches
    .filter((b) => b.productId === product.id)
    .map((b) => {
      const c = classifyBatch(product, b, today, policy)
      const kind: OwnerBatchRow['kind'] = c.kind === 'sellable' ? (c.near ? 'near' : 'sellable') : c.kind
      const valid = b.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(b.expiryDate)
      return {
        id: b.id,
        batchNo: b.batchNo,
        qty: b.qty,
        expiryDate: b.expiryDate,
        status: b.status,
        kind,
        daysToExpiry: valid && !Number.isNaN(Date.parse(`${b.expiryDate}T00:00:00Z`)) ? daysBetween(today, b.expiryDate!) : null,
      }
    })
}

/** Turn a product's situation into the alerts an owner should see, most urgent first. Pure. */
export function describeProblems(product: Product, batches: Batch[], policy: ExpiryPolicy, now: Date, lowStock: boolean, sellableQty: number): Problem[] {
  const today = istDate(now)
  const out: Problem[] = []
  const name = product.name.en
  const mine = batches.filter((b) => b.productId === product.id)

  const expired: Batch[] = []
  const todayB: Batch[] = []
  const near: { b: Batch; expiry: string; sold: boolean }[] = []
  const invalid: Batch[] = []
  for (const b of mine) {
    const c = classifyBatch(product, b, today, policy)
    if (c.kind === 'expired') expired.push(b)
    else if (c.kind === 'expires_today') todayB.push(b)
    else if (c.kind === 'near_unsold') near.push({ b, expiry: c.expiry, sold: false })
    else if (c.kind === 'sellable' && c.near && c.expiry) near.push({ b, expiry: c.expiry, sold: true })
    else if (c.kind === 'missing_expiry' || c.kind === 'invalid_expiry') invalid.push(b)
  }
  const sig = (bucket: string, bs: Batch[]) => `${bucket}:${bs.map((b) => `${b.id}@${b.expiryDate ?? 'none'}`).sort().join(',')}`

  if (expired.length)
    out.push({
      bucket: 'expired',
      severity: 'critical',
      title: `Expired: ${name}`,
      body: `${expired.map((b) => `batch ${b.batchNo} (${units(b.qty)}, expired ${fmt(b.expiryDate!)})`).join('; ')}. Blocked from sale automatically. Record a write-off or receive fresh stock.`,
      signature: sig('expired', expired),
    })
  if (todayB.length)
    out.push({
      bucket: 'expires_today',
      severity: 'critical',
      title: `Expires today: ${name}`,
      body: `${todayB.map((b) => `batch ${b.batchNo} (${units(b.qty)})`).join('; ')} expires today and is blocked from sale by policy. Remove it from the shelf.`,
      signature: sig('today', todayB),
    })
  if (near.length) {
    const unsold = near.some((n) => !n.sold)
    out.push({
      bucket: 'expiring_soon',
      severity: 'warning',
      title: `Expiring soon: ${name}`,
      body: `${near.map((n) => `batch ${n.b.batchNo} (${units(n.b.qty)}, expires ${fmt(n.expiry)})`).join('; ')}. ${
        unsold ? 'Part of this stock is held back from sale by your policy. Review it.' : 'It is still on sale with a short-shelf-life note. Consider a discount or taking it off the shelf.'
      }`,
      signature: sig('near', near.map((n) => n.b)),
    })
  }
  if (invalid.length)
    out.push({
      bucket: 'invalid_expiry',
      severity: 'critical',
      title: `Unreadable expiry date: ${name}`,
      body: `${invalid.map((b) => `batch ${b.batchNo} (${units(b.qty)})`).join('; ')} has no valid expiry date, so it is not for sale. Correct the date to put it back on sale.`,
      signature: sig('invalid', invalid),
    })
  if (lowStock && product.available && !product.flaggedForRemoval)
    out.push({
      bucket: 'low_stock',
      severity: 'info',
      title: `Low stock: ${name}`,
      body: `Only ${units(sellableQty)} left that can be sold.`,
      signature: `low:${today}`,
    })
  return out
}

export interface ExpiryService {
  /** Evaluate one store and announce any new situations. Returns how many alerts were created. */
  scanStore(storeId: string, now?: Date): Promise<number>
  scanAll(now?: Date): Promise<number>
  /** Every product of a store with the owner's worklist view of it. */
  ownerRows(storeId: string, now?: Date): Promise<OwnerProductRow[]>
}

interface Deps {
  stores: StoreRepository
  catalog: CatalogRepository
  notifications: NotificationService
  clock: () => Date
}

export function createExpiryService({ stores, catalog, notifications, clock }: Deps): ExpiryService {
  async function ownerRows(storeId: string, now: Date = clock()): Promise<OwnerProductRow[]> {
    const svc = createCatalogService(await stores.listAll(), now, catalog.snapshot(), (id) => catalog.overridesFor(id))
    const snap = catalog.snapshot()
    return svc
      .verdicts()
      .filter((v) => v.product.storeId === storeId)
      .map((v) => {
        const policy = svc.policyFor(v.product)
        return {
          product: v.product,
          eligibility: v.eligibility,
          batches: batchRows(v.product, snap.batches, policy, now),
          policy,
          buckets: bucketsFor(v.eligibility),
          status: v.eligibility.status,
        }
      })
  }

  async function scanStore(storeId: string, now: Date = clock()): Promise<number> {
    const rows = await ownerRows(storeId, now) // the only await; the rest is synchronous
    const snap = catalog.snapshot()
    let created = 0
    for (const row of rows) {
      const problems = describeProblems(row.product, snap.batches, row.policy, now, row.eligibility.status === 'low_stock', row.eligibility.sellableQty)
      for (const p of problems) {
        const sent = notifications.send(
          { storeId, kind: p.bucket === 'low_stock' ? 'stock' : 'expiry', severity: p.severity, title: p.title, body: p.body, productId: row.product.id, dedupeKey: `${p.bucket}:${row.product.id}:${p.signature}` },
          now,
        )
        if (sent) created++
      }
    }
    return created
  }

  return {
    scanStore,
    async scanAll(now = clock()) {
      let n = 0
      for (const s of await stores.listAll()) n += await scanStore(s.id, now)
      return n
    },
    ownerRows,
  }
}
