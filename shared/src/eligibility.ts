import { daysBetween, isValidIsoDate, istDate } from './dates.ts'
import type {
  Batch,
  CustomerEligibility,
  Department,
  Eligibility,
  EligibilityStatus,
  ExpiryPolicy,
  Product,
  ReasonCode,
} from './types.ts'

/**
 * The freshness / eligibility engine. Pure and deterministic: (product, batches, now, policy) -> verdict.
 * The SERVER is authoritative; the client may run it only to display things it already received.
 *
 * Defaults follow the product brief: expired → blocked, expiring today → blocked, near expiry → alert the owner
 * (and, by default, still sellable with a short-shelf-life note), valid stock → eligible.
 */

export const PLATFORM_POLICY: ExpiryPolicy = {
  nearExpiryDays: 7,
  sellNearExpiry: true,
  blockOnExpiryDay: true,
  lowStockAt: 5,
}

/** One size does not fit all: a loaf of bread and a bag of rice have very different shelf lives. */
export const DEPARTMENT_POLICIES: Record<Department, Partial<ExpiryPolicy>> = {
  fresh: { nearExpiryDays: 1 },
  bakery: { nearExpiryDays: 1 },
  chilled: { nearExpiryDays: 2 },
  beverages: { nearExpiryDays: 21 },
  snacks: { nearExpiryDays: 14 },
  pantry: { nearExpiryDays: 30 },
  personal_care: { nearExpiryDays: 60 },
  household: { nearExpiryDays: 60 },
}

/** Overrides layered above the department default: platform admin / store owner configuration. */
export interface PolicyOverrides {
  store?: Partial<ExpiryPolicy>
  department?: Partial<Record<Department, Partial<ExpiryPolicy>>>
}

/** Resolution order, lowest to highest precedence: platform → department → store → product. */
export function resolvePolicy(product: Product, overrides: PolicyOverrides = {}): ExpiryPolicy {
  return {
    ...PLATFORM_POLICY,
    ...DEPARTMENT_POLICIES[product.department],
    ...overrides.department?.[product.department],
    ...overrides.store,
    ...product.policyOverride,
  }
}

/** What one batch is, as far as selling is concerned. The single place this rule lives. */
export type BatchClass =
  | { kind: 'inactive' }
  | { kind: 'missing_expiry'; qty: number }
  | { kind: 'invalid_expiry'; qty: number }
  | { kind: 'expired'; qty: number }
  | { kind: 'expires_today'; qty: number }
  | { kind: 'near_unsold'; qty: number; expiry: string }
  | { kind: 'sellable'; qty: number; expiry: string | null; near: boolean }

export function classifyBatch(product: Product, b: Batch, today: string, pol: ExpiryPolicy): BatchClass {
  if (b.status !== 'active') return { kind: 'inactive' }
  const qty = Number.isFinite(b.qty) && b.qty > 0 ? Math.floor(b.qty) : 0
  if (!product.requiresExpiry) return { kind: 'sellable', qty, expiry: null, near: false }
  if (b.expiryDate === null || b.expiryDate === undefined || b.expiryDate === '') return { kind: 'missing_expiry', qty }
  if (!isValidIsoDate(b.expiryDate)) return { kind: 'invalid_expiry', qty }
  const days = daysBetween(today, b.expiryDate)
  if (days < 0) return { kind: 'expired', qty }
  if (days === 0 && pol.blockOnExpiryDay) return { kind: 'expires_today', qty }
  const near = days <= pol.nearExpiryDays
  if (near && !pol.sellNearExpiry) return { kind: 'near_unsold', qty, expiry: b.expiryDate }
  return { kind: 'sellable', qty, expiry: b.expiryDate, near }
}

export interface SellableBatch {
  batch: Batch
  qty: number
  expiry: string | null
}

/**
 * The batches stock may be drawn from right now, earliest expiry first (FEFO). Reservation uses this, so an order can
 * never take units from an expired, blocked or invalid batch — the same rule the catalog uses to show the product.
 */
export function sellableBatches(product: Product, batches: Batch[], now: Date = new Date(), policy?: ExpiryPolicy): SellableBatch[] {
  const pol = policy ?? resolvePolicy(product)
  const today = istDate(now)
  const out: SellableBatch[] = []
  for (const b of batches) {
    if (b.productId !== product.id) continue
    const c = classifyBatch(product, b, today, pol)
    if (c.kind === 'sellable' && c.qty > 0) out.push({ batch: b, qty: c.qty, expiry: c.expiry })
  }
  return out.sort((a, b) => {
    if (a.expiry === b.expiry) return a.batch.id.localeCompare(b.batch.id)
    if (a.expiry === null) return 1
    if (b.expiry === null) return -1
    return a.expiry < b.expiry ? -1 : 1
  })
}

export interface EvaluateInput {
  product: Product
  batches: Batch[]
  now?: Date
  policy?: ExpiryPolicy
}

export function evaluateEligibility({ product, batches, now = new Date(), policy }: EvaluateInput): Eligibility {
  const pol = policy ?? resolvePolicy(product)
  const today = istDate(now)
  const reasons = new Set<ReasonCode>()

  let sellableQty = 0
  let totalQty = 0
  let expiredQty = 0
  let todayQty = 0
  let invalidBatches = 0
  let blockedBatches = 0
  let nearUnsoldQty = 0
  let nearSoldQty = 0
  let bestBefore: string | null = null
  let bestBeforeIsNear = false

  const mine = batches.filter((b) => b.productId === product.id)

  for (const b of mine) {
    const c = classifyBatch(product, b, today, pol)
    if (c.kind === 'inactive') {
      blockedBatches++
      reasons.add('BATCH_BLOCKED')
      continue
    }
    totalQty += c.qty
    switch (c.kind) {
      case 'missing_expiry':
        invalidBatches++
        reasons.add('MISSING_EXPIRY')
        break
      case 'invalid_expiry':
        invalidBatches++
        reasons.add('INVALID_EXPIRY')
        break
      case 'expired':
        expiredQty += c.qty
        reasons.add('EXPIRED_BATCH')
        break
      case 'expires_today':
        todayQty += c.qty
        reasons.add('EXPIRES_TODAY')
        break
      case 'near_unsold':
        nearUnsoldQty += c.qty
        reasons.add('NEAR_EXPIRY')
        reasons.add('NEAR_EXPIRY_NOT_SOLD')
        break
      case 'sellable':
        if (c.near) {
          reasons.add('NEAR_EXPIRY')
          nearSoldQty += c.qty
        }
        if (c.expiry && c.qty > 0 && (bestBefore === null || c.expiry < bestBefore)) {
          bestBefore = c.expiry
          bestBeforeIsNear = c.near
        }
        sellableQty += c.qty
        break
    }
  }

  if (mine.length === 0) reasons.add('NO_BATCHES')

  const daysToExpiry = bestBefore ? daysBetween(today, bestBefore) : null
  const needsOwnerAction =
    expiredQty > 0 || todayQty > 0 || invalidBatches > 0 || blockedBatches > 0 || nearSoldQty > 0 || nearUnsoldQty > 0

  const done = (status: EligibilityStatus, sellable: boolean): Eligibility => ({
    status,
    sellable,
    sellableQty: sellable ? sellableQty : 0,
    totalQty,
    reasons: [...reasons],
    bestBefore: sellable ? bestBefore : null,
    daysToExpiry: sellable ? daysToExpiry : null,
    needsOwnerAction,
  })

  // Owner-level switches win over any stock figure.
  if (!product.available) {
    reasons.add('UNAVAILABLE')
    return done('blocked', false)
  }
  if (product.flaggedForRemoval) {
    reasons.add('FLAGGED_FOR_REMOVAL')
    return done('blocked', false)
  }

  if (sellableQty <= 0) {
    if (expiredQty > 0 || todayQty > 0) return done('expired', false)
    if (invalidBatches > 0 || nearUnsoldQty > 0) return done('requires_review', false)
    if (blockedBatches > 0 && totalQty === 0) return done('blocked', false)
    reasons.add('NO_STOCK')
    return done('out_of_stock', false)
  }

  if (nearSoldQty > 0 && bestBeforeIsNear) return done('near_expiry', true)
  if (sellableQty <= pol.lowStockAt) {
    reasons.add('LOW_STOCK')
    return done('low_stock', true)
  }
  return done('eligible', true)
}

/** Customers may see sellable items, and sold-out items (greyed). Everything else is withheld. */
export function isVisibleToCustomer(e: Eligibility): boolean {
  return e.sellable || e.status === 'out_of_stock'
}

/** The single rule for "may this go in a basket / past checkout". Phase 4 calls it again at every gate. */
export function canPurchase(e: Eligibility, qty: number): boolean {
  return e.sellable && Number.isInteger(qty) && qty >= 1 && qty <= e.sellableQty
}

/** Project a full verdict down to what a customer is allowed to know. */
export function toCustomerEligibility(e: Eligibility): CustomerEligibility {
  const status: CustomerEligibility['status'] =
    e.status === 'low_stock' || e.status === 'near_expiry' || e.status === 'eligible' ? e.status : 'out_of_stock'
  return {
    status,
    sellable: e.sellable,
    sellableQty: e.sellableQty,
    bestBefore: e.bestBefore,
    daysToExpiry: e.daysToExpiry,
  }
}
