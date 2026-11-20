import type { Allocation } from '../catalog/catalog.repository.js'
import type {
  Localised,
  OrderAddressView,
  OrderStatus,
  PaymentMethodId,
  PaymentStatus,
  SlotChoice,
  StoreOrderStatus,
} from '@thulir/shared'

/** Internal order shape. Allocations (which batches stock came from) never leave the server. */
export interface OrderItemRecord {
  productId: string
  name: Localised
  brand: string
  unit: string
  pricePaise: number
  mrpPaise: number
  qty: number
  allocations: Allocation[]
}

export interface StoreOrderRecord {
  id: string
  storeId: string
  storeSlug: string
  storeName: Localised
  status: StoreOrderStatus
  /** Every status reached and when, in order. The customer's timeline is built from this. */
  history: { status: StoreOrderStatus; at: string; by: 'customer' | 'store' | 'delivery' | 'admin' | 'system' }[]
  rejectReason: string | null
  refundSimulatedPaise: number
  /** The delivery partner assigned when the store marks the order ready. */
  partnerId: string | null
  partnerName: string | null
  /** 4-digit handover code (simulated OTP). Shown only to the customer; checked when the partner delivers. */
  deliveryCode: string
  codeAttempts: number
  updatedAt: string
  items: OrderItemRecord[]
  subtotalPaise: number
  offerDiscountPaise: number
  deliveryFeePaise: number
  totalPaise: number
  etaMin: number
}

export interface PaymentRecord {
  method: PaymentMethodId
  providerRef: string
  status: PaymentStatus
  amountPaise: number
  attempts: number
}

export interface OrderRecord {
  id: string
  /** SHA-256 of the guest token. The raw token is never stored. */
  ownerHash: string
  idempotencyKey: string
  /** Fingerprint of the request, so a reused key with a different basket is refused. */
  fingerprint: string
  status: OrderStatus
  createdAt: string
  confirmedAt: string | null
  cancelReason: string | null
  reservationExpiresAt: string | null
  address: OrderAddressView
  slot: SlotChoice
  slotLabel: string
  storeOrders: StoreOrderRecord[]
  subtotalPaise: number
  discountPaise: number
  deliveryPaise: number
  totalPaise: number
  payment: PaymentRecord
}
