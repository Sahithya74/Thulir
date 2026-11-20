import { randomBytes } from 'node:crypto'
import {
  daysBetween,
  isValidIsoDate,
  istDate,
  type Batch,
  type Department,
  type ExpiryPolicy,
  type OwnerProductRow,
  type OwnerStorePolicies,
  type PackShape,
  type Product,
  type UserRole,
} from '@thulir/shared'
import { AppError } from '../../middleware/errors.js'
import type { AuditLog } from '../audit/audit.repository.js'
import type { CatalogRepository } from '../catalog/catalog.repository.js'
import type { ExpiryService } from '../expiry/expiry.service.js'

export interface Actor {
  id: string
  name: string
  role: UserRole
}

export const POLICY_LIMITS: OwnerStorePolicies['limits'] = {
  nearExpiryDays: { min: 0, max: 90 },
  lowStockAt: { min: 0, max: 100 },
  blockOnExpiryDayLocked: true,
}

/** A date further out than this is almost certainly a typo (2062 for 2026). */
const MAX_SHELF_LIFE_DAYS = 365 * 5
const MAX_QTY = 10_000

const DEPARTMENTS: Department[] = ['fresh', 'pantry', 'chilled', 'household', 'personal_care', 'snacks', 'beverages', 'bakery']

export interface ProductInput {
  name: { en: string; ta: string }
  brand: string
  department: Department
  unit: string
  pricePaise: number
  mrpPaise: number
  description: string
  shape: PackShape
  color?: string
  tags: string[]
  veg: boolean
  requiresExpiry: boolean
  initialBatch?: { batchNo: string; qty: number; expiryDate?: string | null }
}

export type ProductPatch = Partial<Pick<ProductInput, 'name' | 'brand' | 'unit' | 'pricePaise' | 'mrpPaise' | 'description' | 'shape' | 'color' | 'tags' | 'veg' | 'department'>> & {
  requiresExpiry?: boolean
}

interface Deps {
  catalog: CatalogRepository
  audit: AuditLog
  expiry: ExpiryService
  clock: () => Date
}

const fail = (status: number, code: string, message: string): never => {
  throw new AppError(status, code, message)
}

function reasonOf(reason: string | undefined, min = 5): string {
  const r = (reason ?? '').replace(/\s+/g, ' ').trim()
  if (r.length < min) fail(422, 'REASON_REQUIRED', `Please give a reason (at least ${min} characters).`)
  return r.slice(0, 300)
}

export interface InventoryService {
  list(storeId: string): Promise<OwnerProductRow[]>
  get(storeId: string, productId: string): Promise<OwnerProductRow>
  createProduct(storeId: string, actor: Actor, input: ProductInput): Promise<OwnerProductRow>
  updateProduct(storeId: string, productId: string, actor: Actor, patch: ProductPatch, reason?: string): Promise<OwnerProductRow>
  setAvailability(storeId: string, productId: string, actor: Actor, available: boolean, reason?: string): Promise<OwnerProductRow>
  setFlag(storeId: string, productId: string, actor: Actor, flagged: boolean, reason?: string): Promise<OwnerProductRow>
  receiveBatch(storeId: string, productId: string, actor: Actor, input: { batchNo: string; qty: number; expiryDate?: string | null }): Promise<OwnerProductRow>
  adjustQty(storeId: string, productId: string, batchId: string, actor: Actor, delta: number, reason?: string): Promise<OwnerProductRow>
  correctExpiry(storeId: string, productId: string, batchId: string, actor: Actor, expiryDate: string, reason?: string): Promise<OwnerProductRow>
  setBatchStatus(storeId: string, productId: string, batchId: string, actor: Actor, status: Batch['status'], reason?: string): Promise<OwnerProductRow>
  setImage(storeId: string, productId: string, actor: Actor, url: string): Promise<{ row: OwnerProductRow; previous: string | undefined }>
  policies(storeId: string): OwnerStorePolicies
  setPolicy(storeId: string, department: Department, actor: Actor, patch: Partial<ExpiryPolicy>, reason?: string): Promise<OwnerStorePolicies>
}

export function createInventoryService({ catalog, audit, expiry, clock }: Deps): InventoryService {
  const log = (actor: Actor, storeId: string, action: string, entityType: string, entityId: string, summary: string, before: unknown, after: unknown, reason: string | null = null) =>
    audit.append({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, storeId, action, entityType, entityId, summary, reason, before, after }, clock())

  /** A product of THIS store, or a 404 — an owner can never reach another store's product by guessing an id. */
  const owned = (storeId: string, productId: string): Product => {
    const p = catalog.findProduct(productId)
    if (!p || p.storeId !== storeId) return fail(404, 'PRODUCT_NOT_FOUND', 'Product not found')
    return p
  }
  const ownedBatch = (storeId: string, productId: string, batchId: string): { p: Product; b: Batch } => {
    const p = owned(storeId, productId)
    const b = catalog.findBatch(batchId)
    if (!b || b.productId !== p.id) return fail(404, 'BATCH_NOT_FOUND', 'Batch not found')
    return { p, b }
  }

  /** After any change, re-run the freshness scan so new problems are announced, and return the fresh owner view. */
  const refresh = async (storeId: string, productId: string): Promise<OwnerProductRow> => {
    await expiry.scanStore(storeId, clock())
    const row = (await expiry.ownerRows(storeId, clock())).find((r) => r.product.id === productId)
    return row ?? fail(404, 'PRODUCT_NOT_FOUND', 'Product not found')
  }

  /** The rules for stock coming in. Already-expired stock, or stock that expires today, is refused. */
  function assertReceivable(p: Product, expiryDate: string | null | undefined) {
    if (!p.requiresExpiry) {
      if (expiryDate) fail(422, 'EXPIRY_NOT_APPLICABLE', 'This product does not carry an expiry date.')
      return
    }
    if (!expiryDate) fail(422, 'EXPIRY_REQUIRED', 'An expiry date is required for this product.')
    if (!isValidIsoDate(expiryDate)) fail(422, 'INVALID_EXPIRY_DATE', 'Enter a real date as YYYY-MM-DD.')
    const days = daysBetween(istDate(clock()), expiryDate as string)
    if (days <= 0) fail(422, 'EXPIRY_IN_PAST', 'Stock that has already expired, or expires today, cannot be received.')
    if (days > MAX_SHELF_LIFE_DAYS) fail(422, 'EXPIRY_TOO_FAR', 'That expiry date is more than five years away. Please check it.')
  }

  const validQty = (n: number, min: number) => {
    if (!Number.isInteger(n) || n < min || n > MAX_QTY) fail(422, 'INVALID_QUANTITY', `Quantity must be a whole number from ${min} to ${MAX_QTY}.`)
  }

  function checkPrices(price: number, mrp: number) {
    if (!Number.isInteger(price) || !Number.isInteger(mrp) || price < 100 || mrp < 100) fail(422, 'INVALID_PRICE', 'Prices must be at least ₹1.')
    if (price > mrp) fail(422, 'PRICE_ABOVE_MRP', 'The selling price cannot be higher than the MRP.')
    if (mrp > 10_000_000) fail(422, 'INVALID_PRICE', 'That price looks too high. Please check it.')
  }

  function checkBatchNo(p: Product, batchNo: string) {
    const no = batchNo.trim().toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9\-_/]{0,29}$/.test(no)) fail(422, 'INVALID_BATCH_NO', 'Batch numbers use letters, digits, - _ / (up to 30 characters).')
    if (catalog.snapshot().batches.some((b) => b.productId === p.id && b.batchNo === no)) fail(409, 'BATCH_EXISTS', 'This batch number already exists for the product.')
    return no
  }

  return {
    list: async (storeId) => expiry.ownerRows(storeId, clock()),
    get: async (storeId, productId) => {
      owned(storeId, productId)
      return refreshQuiet(storeId, productId)
    },

    async createProduct(storeId, actor, input) {
      if (!DEPARTMENTS.includes(input.department)) fail(422, 'INVALID_DEPARTMENT', 'Unknown department.')
      checkPrices(input.pricePaise, input.mrpPaise)
      if (!/\d/.test(input.unit)) fail(422, 'INVALID_UNIT', 'Give the pack size with a number, e.g. "500 g" or "1 litre".')
      const product: Product = {
        id: `np-${randomBytes(4).toString('hex')}`,
        storeId,
        department: input.department,
        name: { en: input.name.en.trim(), ta: input.name.ta.trim() },
        brand: input.brand.trim(),
        unit: input.unit.trim(),
        pricePaise: input.pricePaise,
        mrpPaise: input.mrpPaise,
        description: input.description.trim(),
        shape: input.shape,
        color: input.color ?? '#c98255',
        tags: [...new Set(input.tags.map((t) => t.toLowerCase()))],
        aliases: [],
        veg: input.veg,
        requiresExpiry: input.requiresExpiry,
        available: true,
        flaggedForRemoval: false,
        isNew: true,
      }
      // Validate the first batch BEFORE anything is stored, so a rejected request leaves no half-created product.
      let firstBatchNo: string | null = null
      if (input.initialBatch) {
        validQty(input.initialBatch.qty, 0)
        assertReceivable(product, input.initialBatch.expiryDate)
        firstBatchNo = input.initialBatch.batchNo.trim().toUpperCase()
        if (!/^[A-Z0-9][A-Z0-9\-_/]{0,29}$/.test(firstBatchNo)) fail(422, 'INVALID_BATCH_NO', 'Batch numbers use letters, digits, - _ / (up to 30 characters).')
      }
      catalog.addProduct(product)
      if (input.initialBatch && firstBatchNo) {
        catalog.addBatch(
          { id: `${product.id}-b1`, productId: product.id, batchNo: firstBatchNo, qty: input.initialBatch.qty, expiryDate: product.requiresExpiry ? input.initialBatch.expiryDate! : null, status: 'active' },
          clock(),
          actor.id,
        )
      }
      log(actor, storeId, 'product.create', 'product', product.id, `Added ${product.name.en} (${product.unit})`, null, { ...product, batch: input.initialBatch ?? null })
      return refresh(storeId, product.id)
    },

    async updateProduct(storeId, productId, actor, patch, reason) {
      const p = owned(storeId, productId)
      if (patch.requiresExpiry !== undefined && patch.requiresExpiry !== p.requiresExpiry) {
        // Turning expiry tracking off would instantly make expired stock sellable. Only the platform may do that.
        fail(403, 'ADMIN_ONLY', 'Whether a product carries an expiry date can only be changed by the platform.')
      }
      const next: Product = { ...p }
      if (patch.name) next.name = { en: patch.name.en.trim(), ta: patch.name.ta.trim() }
      if (patch.brand !== undefined) next.brand = patch.brand.trim()
      if (patch.unit !== undefined) {
        if (!/\d/.test(patch.unit)) fail(422, 'INVALID_UNIT', 'Give the pack size with a number, e.g. "500 g" or "1 litre".')
        next.unit = patch.unit.trim()
      }
      if (patch.description !== undefined) next.description = patch.description.trim()
      if (patch.shape) next.shape = patch.shape
      if (patch.color) next.color = patch.color
      if (patch.tags) next.tags = [...new Set(patch.tags.map((t) => t.toLowerCase()))]
      if (patch.veg !== undefined) next.veg = patch.veg
      if (patch.department) {
        if (!DEPARTMENTS.includes(patch.department)) fail(422, 'INVALID_DEPARTMENT', 'Unknown department.')
        next.department = patch.department
      }
      if (patch.pricePaise !== undefined || patch.mrpPaise !== undefined) {
        next.pricePaise = patch.pricePaise ?? p.pricePaise
        next.mrpPaise = patch.mrpPaise ?? p.mrpPaise
        checkPrices(next.pricePaise, next.mrpPaise)
      }
      const before = { ...p }
      catalog.saveProduct(next)
      const priceNote = next.pricePaise !== p.pricePaise ? ` Price ₹${p.pricePaise / 100} → ₹${next.pricePaise / 100}.` : ''
      log(actor, storeId, 'product.update', 'product', p.id, `Updated ${p.name.en}.${priceNote}`, before, next, reason ? reasonOf(reason) : null)
      return refresh(storeId, p.id)
    },

    async setAvailability(storeId, productId, actor, available, reason) {
      const p = owned(storeId, productId)
      if (p.available === available) return refresh(storeId, p.id)
      const r = available ? null : reasonOf(reason)
      catalog.saveProduct({ ...p, available })
      log(actor, storeId, available ? 'product.enable' : 'product.disable', 'product', p.id, `${available ? 'Put back on sale' : 'Switched off'}: ${p.name.en}`, { available: p.available }, { available }, r)
      return refresh(storeId, p.id)
    },

    async setFlag(storeId, productId, actor, flagged, reason) {
      const p = owned(storeId, productId)
      if (p.flaggedForRemoval === flagged) return refresh(storeId, p.id)
      const r = reasonOf(reason)
      catalog.saveProduct({ ...p, flaggedForRemoval: flagged })
      log(actor, storeId, flagged ? 'product.flag' : 'product.unflag', 'product', p.id, `${flagged ? 'Marked for removal' : 'Removal mark cleared'}: ${p.name.en}`, { flaggedForRemoval: p.flaggedForRemoval }, { flaggedForRemoval: flagged }, r)
      return refresh(storeId, p.id)
    },

    async receiveBatch(storeId, productId, actor, input) {
      const p = owned(storeId, productId)
      validQty(input.qty, 1)
      assertReceivable(p, input.expiryDate)
      const no = checkBatchNo(p, input.batchNo)
      const batch: Batch = { id: `${p.id}-b${randomBytes(3).toString('hex')}`, productId: p.id, batchNo: no, qty: input.qty, expiryDate: p.requiresExpiry ? input.expiryDate! : null, status: 'active' }
      catalog.addBatch(batch, clock(), actor.id)
      log(actor, storeId, 'batch.receive', 'batch', batch.id, `Received ${input.qty} × ${p.name.en} (batch ${no}${batch.expiryDate ? `, expires ${batch.expiryDate}` : ''})`, null, batch)
      return refresh(storeId, p.id)
    },

    async adjustQty(storeId, productId, batchId, actor, delta, reason) {
      const { p, b } = ownedBatch(storeId, productId, batchId)
      if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_QTY) fail(422, 'INVALID_QUANTITY', 'Enter a non-zero whole number.')
      const r = reasonOf(reason)
      if (b.status === 'removed') fail(422, 'BATCH_REMOVED', 'This batch was written off and cannot be changed.')
      if (b.qty + delta < 0) fail(422, 'NEGATIVE_STOCK', `Only ${b.qty} unit${b.qty === 1 ? '' : 's'} on hand.`)
      const before = { qty: b.qty }
      catalog.adjustBatchQty(b.id, delta, actor.id, r, clock())
      log(actor, storeId, 'batch.adjust', 'batch', b.id, `${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} of ${p.name.en} (batch ${b.batchNo})`, before, { qty: b.qty }, r)
      return refresh(storeId, p.id)
    },

    async correctExpiry(storeId, productId, batchId, actor, expiryDate, reason) {
      const { p, b } = ownedBatch(storeId, productId, batchId)
      if (!p.requiresExpiry) fail(422, 'EXPIRY_NOT_APPLICABLE', 'This product does not carry an expiry date.')
      const r = reasonOf(reason)
      if (b.status === 'removed') fail(422, 'BATCH_REMOVED', 'This batch was written off and cannot be changed.')
      const today = istDate(clock())
      // The loophole this closes: re-dating stock that has already expired so it can be sold again.
      if (isValidIsoDate(b.expiryDate) && daysBetween(today, b.expiryDate as string) <= 0) {
        fail(422, 'CANNOT_REDATE_EXPIRED', 'Expired stock cannot be re-dated. Write this batch off and receive new stock instead.')
      }
      assertReceivable(p, expiryDate)
      const before = { expiryDate: b.expiryDate }
      catalog.saveBatch({ ...b, expiryDate })
      log(actor, storeId, 'batch.expiry', 'batch', b.id, `Changed expiry of ${p.name.en} batch ${b.batchNo}: ${b.expiryDate ?? 'none'} → ${expiryDate}`, before, { expiryDate }, r)
      return refresh(storeId, p.id)
    },

    async setBatchStatus(storeId, productId, batchId, actor, status, reason) {
      const { p, b } = ownedBatch(storeId, productId, batchId)
      if (b.status === 'removed') fail(422, 'BATCH_REMOVED', 'A written-off batch cannot be brought back.')
      if (b.status === status) return refresh(storeId, p.id)
      const r = status === 'active' ? null : reasonOf(reason)
      catalog.saveBatch({ ...b, status })
      log(actor, storeId, `batch.${status}`, 'batch', b.id, `${status === 'removed' ? 'Wrote off' : status === 'blocked' ? 'Blocked' : 'Unblocked'} ${p.name.en} batch ${b.batchNo}`, { status: b.status }, { status }, r)
      return refresh(storeId, p.id)
    },

    async setImage(storeId, productId, actor, url) {
      const p = owned(storeId, productId)
      catalog.saveProduct({ ...p, imageUrl: url })
      log(actor, storeId, 'product.image', 'product', p.id, `Updated photo of ${p.name.en}`, { imageUrl: p.imageUrl ?? null }, { imageUrl: url })
      return { row: await refresh(storeId, p.id), previous: p.imageUrl }
    },

    policies(storeId) {
      return { departments: catalog.storeChoices(storeId).department ?? {}, limits: POLICY_LIMITS }
    },

    async setPolicy(storeId, department, actor, patch, reason) {
      if (!DEPARTMENTS.includes(department)) fail(422, 'INVALID_DEPARTMENT', 'Unknown department.')
      // Owners cannot loosen the platform's safety rules.
      if (patch.blockOnExpiryDay !== undefined) fail(403, 'ADMIN_ONLY', 'Blocking stock on its expiry day is set by the platform and cannot be changed here.')
      const r = reasonOf(reason)
      const clean: Partial<ExpiryPolicy> = {}
      if (patch.nearExpiryDays !== undefined) {
        const { min, max } = POLICY_LIMITS.nearExpiryDays
        if (!Number.isInteger(patch.nearExpiryDays) || patch.nearExpiryDays < min || patch.nearExpiryDays > max) fail(422, 'INVALID_POLICY', `Near-expiry window must be ${min} to ${max} days.`)
        clean.nearExpiryDays = patch.nearExpiryDays
      }
      if (patch.lowStockAt !== undefined) {
        const { min, max } = POLICY_LIMITS.lowStockAt
        if (!Number.isInteger(patch.lowStockAt) || patch.lowStockAt < min || patch.lowStockAt > max) fail(422, 'INVALID_POLICY', `Low-stock level must be ${min} to ${max}.`)
        clean.lowStockAt = patch.lowStockAt
      }
      if (patch.sellNearExpiry !== undefined) clean.sellNearExpiry = Boolean(patch.sellNearExpiry)
      if (Object.keys(clean).length === 0) fail(422, 'INVALID_POLICY', 'Nothing to change.')
      const before = catalog.storeChoices(storeId).department?.[department] ?? null
      catalog.setDepartmentPolicy(storeId, department, clean)
      log(actor, storeId, 'policy.update', 'policy', `${storeId}:${department}`, `Changed ${department.replace('_', ' ')} freshness rules`, before, clean, r)
      await expiry.scanStore(storeId, clock())
      return { departments: catalog.storeChoices(storeId).department ?? {}, limits: POLICY_LIMITS }
    },
  }

  async function refreshQuiet(storeId: string, productId: string): Promise<OwnerProductRow> {
    const row = (await expiry.ownerRows(storeId, clock())).find((r) => r.product.id === productId)
    return row ?? fail(404, 'PRODUCT_NOT_FOUND', 'Product not found')
  }
}
