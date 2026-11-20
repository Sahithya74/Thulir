import {
  buildDemoCatalog,
  createCatalogService,
  demoStores,
  withDeliveryAll,
  type CartLineInput,
  type CartValidation,
  type GeoPoint,
  type OrderView,
  type PaymentMethodId,
  type PaymentMethodInfo,
  type SlotChoice,
} from '@thulir/shared'
import { getGuestToken } from '@/store/guest'
import { ApiError, send } from './api'

const auth = () => ({ 'X-Guest-Token': getGuestToken() })

export interface CreateOrderBody {
  lines: CartLineInput[]
  address: { name: string; phone: string; line1: string; areaId: string; pincode: string; instructions: string }
  slot: SlotChoice
  paymentMethod: PaymentMethodId
  idempotencyKey: string
}

/** Offline-only stand-in so the basket can still be viewed when the server is unreachable. Ordering never uses it. */
let localData: ReturnType<typeof buildDemoCatalog> | null = null
function validateLocally(lines: CartLineInput[], geo: GeoPoint): CartValidation {
  localData ??= buildDemoCatalog(new Date())
  const now = new Date()
  return createCatalogService(demoStores, now, localData).cart(lines, withDeliveryAll(demoStores, geo))
}

export const ordersApi = {
  paymentMethods: (signal?: AbortSignal) => send<PaymentMethodInfo[]>('/payments/methods', { signal }),

  /** Server-authoritative basket pricing + validation. Falls back to local logic only when the API is unreachable. */
  async validateCart(lines: CartLineInput[], geo: GeoPoint, signal?: AbortSignal): Promise<{ data: CartValidation; source: 'api' | 'local' }> {
    try {
      const data = await send<CartValidation>('/cart/validate', { method: 'POST', body: { lines, lat: geo.lat, lng: geo.lng }, signal })
      return { data, source: 'api' }
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) return { data: validateLocally(lines, geo), source: 'local' }
      throw e
    }
  },

  createOrder: (body: CreateOrderBody, signal?: AbortSignal) => send<OrderView>('/orders', { method: 'POST', body, headers: auth(), signal }),
  getOrder: (id: string, signal?: AbortSignal) => send<OrderView>(`/orders/${encodeURIComponent(id)}`, { headers: auth(), signal }),
  listOrders: (signal?: AbortSignal) => send<OrderView[]>('/orders', { headers: auth(), signal }),
  simulatePayment: (id: string, outcome: 'success' | 'failure') =>
    send<OrderView>(`/orders/${encodeURIComponent(id)}/payment/simulate`, { method: 'POST', body: { outcome }, headers: auth() }),
  cancelOrder: (id: string) => send<OrderView>(`/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST', headers: auth() }),
}
