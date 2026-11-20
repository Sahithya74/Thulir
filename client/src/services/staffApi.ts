import type {
  AdminAnalytics,
  AdminComplianceRow,
  AdminOrderRow,
  AdminStoreRow,
  AuditEntryView,
  Department,
  ExpiryPolicy,
  PartnerOrderView,
  PlatformPolicies,
  StoreOrderStatus,
} from '@thulir/shared'
import { call } from './ownerApi'

/** Delivery partner API. The server only ever returns orders assigned to the signed-in partner. */
export const deliveryApi = {
  orders: () => call<PartnerOrderView[]>('GET', '/delivery/orders'),
  transition: (soid: string, to: StoreOrderStatus, code?: string) =>
    call<PartnerOrderView>('POST', `/delivery/orders/${encodeURIComponent(soid)}/transition`, { to, ...(code ? { code } : {}) }),
}

export type AdminAuditEntry = AuditEntryView & { storeId: string | null }

/** Platform admin API. Every change needs a reason; the server refuses it otherwise and audits it when accepted. */
export const adminApi = {
  analytics: () => call<AdminAnalytics>('GET', '/admin/analytics'),
  stores: () => call<AdminStoreRow[]>('GET', '/admin/stores'),
  setStoreStatus: (id: string, status: 'active' | 'suspended', reason: string) => call<AdminStoreRow>('POST', `/admin/stores/${encodeURIComponent(id)}/status`, { status, reason }),
  orders: () => call<AdminOrderRow[]>('GET', '/admin/orders'),
  cancelOrder: (soid: string, reason: string) => call<AdminOrderRow>('POST', `/admin/orders/${encodeURIComponent(soid)}/cancel`, { reason }),
  compliance: () => call<AdminComplianceRow[]>('GET', '/admin/compliance'),
  policies: () => call<PlatformPolicies>('GET', '/admin/policies'),
  setPolicy: (d: Department, patch: Partial<ExpiryPolicy>, reason: string) => call<PlatformPolicies>('PUT', `/admin/policies/${d}`, { ...patch, reason }),
  audit: (limit = 200) => call<AdminAuditEntry[]>('GET', `/admin/audit?limit=${limit}`),
}
