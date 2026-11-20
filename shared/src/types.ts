/** Domain types shared by the Thulir client and server. */

import type { GeoPoint } from './geo.ts'

export type StoreCategory =
  | 'supermarket'
  | 'provision'
  | 'fruit_veg'
  | 'bakery'
  | 'dairy'
  | 'household'

export type Localised = { en: string; ta: string }

export type OfferKind = 'percent' | 'flat' | 'free_delivery'

export interface Offer {
  id: string
  kind: OfferKind
  label: Localised
  /** percent: whole-number percentage off qualifying items. */
  percent?: number
  /** flat: fixed amount off the store's subtotal. */
  flatPaise?: number
  /** The store's item subtotal must reach this before the offer applies. */
  minSubtotalPaise?: number
  /** Restrict a percent offer to items carrying this tag / in this department. */
  appliesToTag?: string
  appliesToDepartment?: string
}

/**
 * How a store's verification was established. Demo stores are NEVER "verified" —
 * `demo` is the only status that fixture data may carry.
 */
export type VerificationStatus = 'demo' | 'pending' | 'verified' | 'suspended'

export interface StoreHours {
  /** 24h "HH:mm" in Asia/Kolkata */
  opens: string
  closes: string
}

export interface Store {
  id: string
  slug: string
  townId: string
  name: Localised
  category: StoreCategory
  tagline: Localised
  rating: number
  reviewCount: number
  /** Fictional location inside the sample town. */
  geo: GeoPoint
  /** Orders from further away than this are not deliverable. */
  deliveryRadiusM: number
  /** Minutes the store typically needs to pack an order (simulated). */
  prepMin: number
  hours: StoreHours
  verification: VerificationStatus
  offers: Offer[]
  /** Platform-computed freshness trust indicator (simulated for demo data). */
  freshness: 'daily' | 'weekly' | 'unchecked'
  deliveryFeePaise: number
  freeDeliveryAbovePaise: number
  isDemo: boolean
  /** Suspended stores are hidden from customers and cannot take orders. Absent means active. */
  status?: 'active' | 'suspended'
}

/** Result of evaluating a store against a customer location. */
export interface DeliveryInfo {
  distanceM: number
  etaMin: number
  deliverable: boolean
}

export interface StoreWithDelivery extends Store {
  delivery: DeliveryInfo
}

export interface Area {
  id: string
  townId: string
  name: Localised
  geo: GeoPoint
}

export interface Town {
  id: string
  name: Localised
  district: Localised
  /** Sample pincodes. A pincode outside this list is not serviceable. */
  pincodes: string[]
  center: GeoPoint
  areas: Area[]
}

export type LocationSource = 'detected' | 'area' | 'address'

/** The place the customer is shopping for. */
export interface UserLocation {
  source: LocationSource
  townId: string
  areaId: string | null
  label: Localised
  geo: GeoPoint
  /** Set when the location came from a saved or entered address. */
  addressId?: string
}

export type AddressLabel = 'home' | 'work' | 'other'

export interface SavedAddress {
  id: string
  label: AddressLabel
  line1: string
  areaId: string
  townId: string
  pincode: string
}

/* ---------------------------------------------------------------- catalog */

export type Department =
  | 'fresh'
  | 'pantry'
  | 'chilled'
  | 'household'
  | 'personal_care'
  | 'snacks'
  | 'beverages'
  | 'bakery'

/** Drives the 3D pack mesh and the generated illustration. */
export type PackShape = 'box' | 'bottle' | 'pouch' | 'jar' | 'crate' | 'carton' | 'tub' | 'bar'

export interface ExpiryPolicy {
  /** A batch expiring within this many days is "near expiry". */
  nearExpiryDays: number
  /** Whether near-expiry stock may still be sold (customers see a short-shelf-life note). */
  sellNearExpiry: boolean
  /** Whether stock expiring today is blocked from sale. Default true. */
  blockOnExpiryDay: boolean
  /** Sellable quantity at or below this counts as low stock. */
  lowStockAt: number
}

export interface Product {
  id: string
  storeId: string
  department: Department
  name: Localised
  brand: string
  /** Display unit, e.g. "500 g", "1 litre", "6 pieces". */
  unit: string
  pricePaise: number
  mrpPaise: number
  description: string
  shape: PackShape
  color: string
  /** Free tags used by missions (e.g. "toordal", "staple"). */
  tags: string[]
  /** Extra search terms, e.g. Tamil transliterations ("arisi"). */
  aliases: string[]
  veg: boolean
  /** False for durable goods (scrub pads, brooms) that carry no expiry date. */
  requiresExpiry: boolean
  /** Owner switch. Off means the product is not for sale. */
  available: boolean
  flaggedForRemoval: boolean
  isNew?: boolean
  policyOverride?: Partial<ExpiryPolicy>
  /** Uploaded photo (served from /uploads). When absent the UI draws a generated illustration. */
  imageUrl?: string
}

export type BatchStatus = 'active' | 'blocked' | 'removed'

/** A received lot of stock. Expiry lives here, never on the product. */
export interface Batch {
  id: string
  productId: string
  batchNo: string
  qty: number
  /** YYYY-MM-DD, or null / garbage when the owner entered nothing valid. */
  expiryDate: string | null
  status: BatchStatus
}

export type EligibilityStatus =
  | 'eligible'
  | 'low_stock'
  | 'near_expiry'
  | 'expired'
  | 'blocked'
  | 'out_of_stock'
  | 'requires_review'

export type ReasonCode =
  | 'UNAVAILABLE'
  | 'FLAGGED_FOR_REMOVAL'
  | 'EXPIRED_BATCH'
  | 'EXPIRES_TODAY'
  | 'NEAR_EXPIRY'
  | 'NEAR_EXPIRY_NOT_SOLD'
  | 'INVALID_EXPIRY'
  | 'MISSING_EXPIRY'
  | 'BATCH_BLOCKED'
  | 'NO_BATCHES'
  | 'NO_STOCK'
  | 'LOW_STOCK'

/** Full server-side verdict (owner/admin views and server logic). */
export interface Eligibility {
  status: EligibilityStatus
  sellable: boolean
  sellableQty: number
  /** Quantity on hand across active batches, sellable or not. */
  totalQty: number
  reasons: ReasonCode[]
  /** Earliest expiry among sellable batches (first-expiry-first-out). */
  bestBefore: string | null
  daysToExpiry: number | null
  needsOwnerAction: boolean
}

/** What a customer may learn. Internal reasons and batch data never leave the server. */
export interface CustomerEligibility {
  status: 'eligible' | 'low_stock' | 'near_expiry' | 'out_of_stock'
  sellable: boolean
  sellableQty: number
  bestBefore: string | null
  daysToExpiry: number | null
}

export interface ProductView {
  id: string
  storeId: string
  department: Department
  name: Localised
  brand: string
  unit: string
  pricePaise: number
  mrpPaise: number
  discountPercent: number
  description: string
  shape: PackShape
  color: string
  tags: string[]
  /** Search-only terms (e.g. transliterations); safe to expose. */
  aliases: string[]
  veg: boolean
  isNew: boolean
  imageUrl: string | null
  eligibility: CustomerEligibility
}

export interface StoreCatalog {
  storeId: string
  products: ProductView[]
  departments: { id: Department; count: number }[]
  /** Items the freshness checks kept off the shelf (expired, blocked, invalid, ...). Count only. */
  hiddenCount: number
  checkedAt: string
}

export interface SearchHit {
  product: ProductView
  store: { id: string; slug: string; name: Localised }
  score: number
}

export type Suggestion =
  | { kind: 'product'; text: string; productId: string; storeSlug: string }
  | { kind: 'brand'; text: string }
  | { kind: 'department'; text: string; department: Department }

export interface Meal {
  id: string
  name: Localised
  blurb: Localised
  /** Ingredient tags; each is resolved to the cheapest sellable product that carries it. */
  ingredients: string[]
}

export interface Mission {
  id: string
  title: Localised
  blurb: Localised
  anyTags?: string[]
  departments?: Department[]
  meals?: Meal[]
  /** Show only products flagged as new. */
  onlyNew?: boolean
}

export interface MissionStoreGroup {
  store: { id: string; slug: string; name: Localised; etaMin: number; distanceM: number }
  products: ProductView[]
}

export interface MissionResult {
  mission: Mission
  groups: MissionStoreGroup[]
  meals: { meal: Meal; items: { tag: string; product: ProductView | null; storeSlug: string | null }[] }[]
}

/* ------------------------------------------------------------ cart & orders */

export type PaymentMethodId = 'cod' | 'upi_sim' | 'online_sim'

export interface PaymentMethodInfo {
  id: PaymentMethodId
  label: string
  /** True when no real payment provider is connected. In this prototype every method is a demo. */
  simulated: boolean
  description: string
}

export interface CartLineInput {
  productId: string
  qty: number
}

export type LineStatus = 'ok' | 'adjusted' | 'removed'
/** Customer-safe reasons. Internal causes (expired, flagged, invalid dates) are all just "unavailable". */
export type LineIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'QTY_REDUCED' | 'NOT_DELIVERABLE' | 'INVALID_QTY'

export interface CartLineView {
  product: ProductView
  requestedQty: number
  qty: number
  lineTotalPaise: number
  status: LineStatus
  issue?: LineIssue
}

export interface AppliedOffer {
  id: string
  label: Localised
  amountPaise: number
}

export interface CartStoreInfo {
  id: string
  slug: string
  name: Localised
  etaMin: number
  distanceM: number
  deliverable: boolean
  freeDeliveryAbovePaise: number
}

export interface CartStoreGroup {
  store: CartStoreInfo
  lines: CartLineView[]
  itemCount: number
  /** Sum of price × qty for lines that can be bought. */
  subtotalPaise: number
  /** MRP minus price: how much below MRP the customer is already paying (informational). */
  mrpSavingsPaise: number
  offerDiscountPaise: number
  appliedOffers: AppliedOffer[]
  deliveryFeePaise: number
  /** Extra spend needed for free delivery, or null when already free / not applicable. */
  freeDeliveryRemainingPaise: number | null
  /** Product prices are MRP-inclusive of tax in this prototype, so this is always 0. */
  taxPaise: number
  totalPaise: number
}

export interface CartIssue {
  productId: string
  name: Localised
  issue: LineIssue
  requestedQty: number
  allowedQty: number
}

export interface CartValidation {
  groups: CartStoreGroup[]
  issues: CartIssue[]
  itemCount: number
  subtotalPaise: number
  discountPaise: number
  deliveryPaise: number
  taxPaise: number
  totalPaise: number
  /** More than one store means more than one delivery. */
  multiDelivery: boolean
  /** True only when every line is fine and every store delivers here. */
  canCheckout: boolean
  checkedAt: string
}

export type SlotChoice = { kind: 'asap' } | { kind: 'window'; startHour: number }

export interface OrderItemView {
  productId: string
  name: Localised
  brand: string
  unit: string
  pricePaise: number
  qty: number
  lineTotalPaise: number
}

export type StoreOrderStatus =
  | 'placed'
  | 'accepted'
  | 'rejected'
  | 'preparing'
  | 'ready'
  | 'handed_over'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'

export interface StoreOrderView {
  id: string
  store: { id: string; slug: string; name: Localised }
  status: StoreOrderStatus
  items: OrderItemView[]
  subtotalPaise: number
  offerDiscountPaise: number
  deliveryFeePaise: number
  totalPaise: number
  etaMin: number
  /** When each status was reached, so the customer can follow progress. */
  history: { status: StoreOrderStatus; at: string }[]
  rejectReason: string | null
  /** Simulated refund when a store rejects an order that was already paid. No money moves. */
  refundSimulatedPaise: number
  /**
   * Handover code the customer gives the delivery partner (simulated OTP). Only ever sent to the customer, and only
   * once the order has left the store.
   */
  deliveryCode: string | null
  /** First name of the delivery partner, once one is assigned. */
  partnerName: string | null
}

/** `completed`: every store order has finished and at least one was delivered. */
export type OrderStatus = 'awaiting_payment' | 'confirmed' | 'completed' | 'cancelled'
export type PaymentStatus = 'cod_pending' | 'awaiting_payment' | 'paid_simulated' | 'failed' | 'void'

export interface PaymentView {
  method: PaymentMethodId
  methodLabel: string
  simulated: boolean
  status: PaymentStatus
  amountPaise: number
  attempts: number
}

export interface OrderAddressView {
  name: string
  phone: string
  line1: string
  area: Localised
  town: Localised
  pincode: string
  instructions: string
}

export interface OrderView {
  id: string
  status: OrderStatus
  createdAt: string
  confirmedAt: string | null
  cancelReason: string | null
  /** While awaiting payment, stock is held until this moment. */
  reservationExpiresAt: string | null
  address: OrderAddressView
  slotLabel: string
  storeOrders: StoreOrderView[]
  multiDelivery: boolean
  subtotalPaise: number
  discountPaise: number
  deliveryPaise: number
  taxPaise: number
  totalPaise: number
  payment: PaymentView
}
