import type { Batch, Department, Eligibility, EligibilityStatus, ExpiryPolicy, Localised, Product } from './types.ts'

export type UserRole = 'customer' | 'store_owner' | 'delivery_partner' | 'admin'

/** What the browser is told about the signed-in person. Never includes the password hash. */
export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  /** Stores this user may manage (owners only). */
  storeIds: string[]
}

/** Everything an owner needs to act on, sorted by how urgent it is. */
export type OwnerBucket = 'expired' | 'expires_today' | 'expiring_soon' | 'needs_review' | 'invalid_expiry' | 'blocked'

/** Display order = priority order: stock that must already be off the shelf comes first. */
export const OWNER_BUCKET_ORDER: OwnerBucket[] = ['expired', 'expires_today', 'expiring_soon', 'needs_review', 'invalid_expiry', 'blocked']

/**
 * Which owner worklists a product belongs in, derived from the engine's verdict. A product can be in several
 * (an expired batch AND a near-expiry batch). This is a view of the verdict, never an input to it.
 */
export function bucketsFor(e: Eligibility): OwnerBucket[] {
  const out = new Set<OwnerBucket>()
  const r = new Set(e.reasons)
  if (r.has('EXPIRED_BATCH')) out.add('expired')
  if (r.has('EXPIRES_TODAY')) out.add('expires_today')
  if (r.has('NEAR_EXPIRY')) out.add('expiring_soon')
  if (r.has('NEAR_EXPIRY_NOT_SOLD') || e.status === 'requires_review') out.add('needs_review')
  if (r.has('INVALID_EXPIRY') || r.has('MISSING_EXPIRY')) out.add('invalid_expiry')
  if (r.has('UNAVAILABLE') || r.has('FLAGGED_FOR_REMOVAL') || r.has('BATCH_BLOCKED') || e.status === 'blocked') out.add('blocked')
  return OWNER_BUCKET_ORDER.filter((b) => out.has(b))
}

export interface OwnerBatchRow {
  id: string
  batchNo: string
  qty: number
  expiryDate: string | null
  status: Batch['status']
  /** What the engine makes of this batch right now. */
  kind: 'inactive' | 'missing_expiry' | 'invalid_expiry' | 'expired' | 'expires_today' | 'near_unsold' | 'sellable' | 'near'
  daysToExpiry: number | null
}

export interface OwnerProductRow {
  product: Product
  eligibility: Eligibility
  batches: OwnerBatchRow[]
  policy: ExpiryPolicy
  buckets: OwnerBucket[]
  status: EligibilityStatus
}

export interface OwnerStorePolicies {
  /** Per-department overrides the owner has set. Anything unset falls back to the platform default. */
  departments: Partial<Record<Department, Partial<ExpiryPolicy>>>
  /** Limits the owner may not exceed. Expiry-day blocking can only be changed by the platform. */
  limits: { nearExpiryDays: { min: number; max: number }; lowStockAt: { min: number; max: number }; blockOnExpiryDayLocked: true }
}

export type NotificationSeverity = 'critical' | 'warning' | 'info'
export type NotificationChannelId = 'in_app' | 'email' | 'sms' | 'whatsapp'

export interface NotificationView {
  id: string
  kind: 'expiry' | 'stock' | 'order'
  severity: NotificationSeverity
  title: string
  body: string
  productId: string | null
  orderId: string | null
  createdAt: string
  read: boolean
  /** Honest per-channel outcome. Only `in_app` can ever be `delivered` in this prototype. */
  deliveries: { channel: NotificationChannelId; status: 'delivered' | 'not_configured' }[]
}

export interface AuditEntryView {
  id: string
  at: string
  actorName: string
  actorRole: UserRole | 'system'
  action: string
  entityType: string
  entityId: string
  summary: string
  reason: string | null
  before: unknown
  after: unknown
}

export interface OwnerStoreOrderView {
  id: string
  orderId: string
  status: import('./types.ts').StoreOrderStatus
  createdAt: string
  slotLabel: string
  paymentLabel: string
  paymentStatus: import('./types.ts').PaymentStatus
  /** First name and delivery area only: owners do not need the customer's phone or street address. */
  customerFirstName: string
  area: Localised
  instructions: string
  items: { productId: string; name: Localised; brand: string; unit: string; qty: number; pricePaise: number }[]
  subtotalPaise: number
  offerDiscountPaise: number
  deliveryFeePaise: number
  totalPaise: number
  rejectReason: string | null
  nextSteps: import('./types.ts').StoreOrderStatus[]
}

export interface OwnerDashboardData {
  ordersToday: number
  pendingOrders: number
  inProgressOrders: number
  completedOrders: number
  /** Value of today's orders that were not rejected or cancelled (cash orders count as expected, not collected). */
  salesTodayPaise: number
  activeProducts: number
  outOfStock: number
  lowStock: number
  buckets: Record<OwnerBucket, number>
  unreadNotifications: number
  recent: AuditEntryView[]
}
