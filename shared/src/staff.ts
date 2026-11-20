import type { Department, ExpiryPolicy, Localised, PaymentStatus, StoreOrderStatus } from './types.ts'

/** What a delivery partner sees: enough to pick up and deliver, nothing more. */
export interface PartnerOrderView {
  id: string
  orderId: string
  status: StoreOrderStatus
  store: { name: Localised; area: Localised }
  customer: { name: string; phone: string; line1: string; area: Localised; pincode: string; instructions: string }
  itemCount: number
  /** Cash to collect on delivery, or 0 if already paid (simulated) online. */
  collectPaise: number
  paymentStatus: PaymentStatus
  etaMin: number
  updatedAt: string
  nextSteps: StoreOrderStatus[]
}

export interface AdminStoreRow {
  id: string
  name: Localised
  category: string
  status: 'active' | 'suspended'
  verification: string
  isDemo: boolean
  products: number
  sellable: number
  hidden: number
  expiredOrBlocked: number
  orders: number
  activeOrders: number
}

export interface AdminOrderRow {
  storeOrderId: string
  orderId: string
  storeId: string
  storeName: Localised
  status: StoreOrderStatus
  createdAt: string
  totalPaise: number
  paymentLabel: string
  paymentStatus: PaymentStatus
  customerName: string
  /** Masked: support staff see enough to recognise a number, not to harvest it. */
  customerPhoneMasked: string
  area: Localised
  rejectReason: string | null
  nextSteps: StoreOrderStatus[]
}

export interface AdminComplianceRow {
  storeId: string
  storeName: Localised
  productId: string
  productName: string
  status: string
  reasons: string[]
}

export interface AdminAnalytics {
  stores: { total: number; active: number; suspended: number }
  orders: { total: number; byStatus: Partial<Record<StoreOrderStatus, number>>; cancelledOrRejected: number }
  /** Sum of non-cancelled, non-rejected store orders (cash orders counted as expected, not collected). */
  gmvPaise: number
  freshness: { products: number; sellable: number; hiddenByChecks: number; compliancePercent: number }
  perStore: { storeId: string; name: Localised; orders: number; gmvPaise: number }[]
}

export interface PlatformPolicies {
  departments: Partial<Record<Department, Partial<ExpiryPolicy>>>
}
