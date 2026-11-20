import type {
  AuditEntryView,
  Department,
  ExpiryPolicy,
  NotificationView,
  OwnerBucket,
  OwnerDashboardData,
  OwnerProductRow,
  OwnerStoreOrderView,
  OwnerStorePolicies,
  SessionUser,
  StoreOrderStatus,
} from '@thulir/shared'
import { ApiError, send } from './api'

/** The session cookie is httpOnly (scripts cannot read it); the CSRF cookie is readable on purpose and echoed back. */
function csrf(): string {
  const m = document.cookie.match(/(?:^|;\s*)thulir_csrf=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT'

export async function call<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (method === 'GET' || method === 'POST') {
    return send<T>(path, { method, body, headers: method === 'POST' ? { 'X-CSRF-Token': csrf() } : undefined })
  }
  let res: Response
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
      body: JSON.stringify(body ?? {}),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'The server is not reachable.')
  }
  const parsed = (await res.json().catch(() => null)) as { data?: T; error?: { code: string; message: string; details?: unknown } } | null
  if (!res.ok || !parsed || parsed.data === undefined) {
    throw new ApiError(res.status, parsed?.error?.code ?? 'BAD_RESPONSE', parsed?.error?.message ?? res.statusText, parsed?.error?.details)
  }
  return parsed.data
}

export const authApi = {
  me: () => send<SessionUser>('/auth/me'),
  login: (email: string, password: string) => send<SessionUser>('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => send<{ ok: true }>('/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf() } }),
}

export interface NotificationsResponse {
  items: NotificationView[]
  unread: number
  channelNote: string
}

export function ownerApi(storeId: string) {
  const base = `/owner/stores/${encodeURIComponent(storeId)}`
  const prod = (pid: string) => `${base}/products/${encodeURIComponent(pid)}`
  const batch = (pid: string, bid: string) => `${prod(pid)}/batches/${encodeURIComponent(bid)}`
  return {
    dashboard: () => call<OwnerDashboardData>('GET', `${base}/dashboard`),
    inventory: () => call<OwnerProductRow[]>('GET', `${base}/inventory`),
    product: (pid: string) => call<OwnerProductRow>('GET', prod(pid)),
    createProduct: (body: unknown) => call<OwnerProductRow>('POST', `${base}/products`, body),
    updateProduct: (pid: string, body: unknown) => call<OwnerProductRow>('PATCH', prod(pid), body),
    setAvailability: (pid: string, available: boolean, reason?: string) => call<OwnerProductRow>('POST', `${prod(pid)}/availability`, { available, ...(reason ? { reason } : {}) }),
    setFlag: (pid: string, flagged: boolean, reason: string) => call<OwnerProductRow>('POST', `${prod(pid)}/flag`, { flagged, reason }),
    receive: (pid: string, body: { batchNo: string; qty: number; expiryDate?: string | null }) => call<OwnerProductRow>('POST', `${prod(pid)}/batches`, body),
    adjust: (pid: string, bid: string, delta: number, reason: string) => call<OwnerProductRow>('PATCH', `${batch(pid, bid)}/qty`, { delta, reason }),
    correctExpiry: (pid: string, bid: string, expiryDate: string, reason: string) => call<OwnerProductRow>('PATCH', `${batch(pid, bid)}/expiry`, { expiryDate, reason }),
    batchStatus: (pid: string, bid: string, status: 'active' | 'blocked' | 'removed', reason?: string) =>
      call<OwnerProductRow>('POST', `${batch(pid, bid)}/status`, { status, ...(reason ? { reason } : {}) }),
    async uploadImage(pid: string, file: File): Promise<OwnerProductRow> {
      let res: Response
      try {
        res = await fetch(`/api/v1${prod(pid)}/image`, { method: 'PUT', headers: { 'Content-Type': file.type, 'X-CSRF-Token': csrf() }, body: file })
      } catch {
        throw new ApiError(0, 'NETWORK', 'The server is not reachable.')
      }
      const parsed = (await res.json().catch(() => null)) as { data?: OwnerProductRow; error?: { code: string; message: string } } | null
      if (!res.ok || !parsed?.data) throw new ApiError(res.status, parsed?.error?.code ?? 'UPLOAD_FAILED', parsed?.error?.message ?? 'Upload failed')
      return parsed.data
    },
    expiry: () => call<{ order: OwnerBucket[]; buckets: Record<OwnerBucket, OwnerProductRow[]> }>('GET', `${base}/expiry`),
    scan: () => call<{ created: number }>('POST', `${base}/expiry/scan`, {}),
    policies: () => call<OwnerStorePolicies>('GET', `${base}/policies`),
    setPolicy: (department: Department, patch: Partial<ExpiryPolicy>, reason: string) => call<OwnerStorePolicies>('PUT', `${base}/policies/${department}`, { ...patch, reason }),
    orders: () => call<OwnerStoreOrderView[]>('GET', `${base}/orders`),
    transition: (soid: string, to: StoreOrderStatus, reason?: string) => call<OwnerStoreOrderView>('POST', `${base}/orders/${encodeURIComponent(soid)}/transition`, { to, ...(reason ? { reason } : {}) }),
    async notifications(): Promise<NotificationsResponse> {
      const res = await fetch(`/api/v1${base}/notifications`, { headers: { Accept: 'application/json' } })
      const parsed = (await res.json().catch(() => null)) as { data?: NotificationView[]; meta?: { unread: number; channelNote: string }; error?: { code: string; message: string } } | null
      if (!res.ok || !parsed?.data) throw new ApiError(res.status, parsed?.error?.code ?? 'BAD_RESPONSE', parsed?.error?.message ?? res.statusText)
      return { items: parsed.data, unread: parsed.meta?.unread ?? 0, channelNote: parsed.meta?.channelNote ?? '' }
    },
    markRead: (nid: string) => call<{ ok: true }>('POST', `${base}/notifications/${encodeURIComponent(nid)}/read`, {}),
    markAllRead: () => call<{ marked: number }>('POST', `${base}/notifications/read-all`, {}),
    audit: (limit = 100) => call<AuditEntryView[]>('GET', `${base}/audit?limit=${limit}`),
  }
}

export type OwnerApi = ReturnType<typeof ownerApi>
