import type { GeoPoint, PincodeCheck, StoreWithDelivery, Town } from '@thulir/shared'

const BASE = '/api/v1'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Structured detail from the server (e.g. the full basket verdict on a 409 CART_CHANGED). */
  readonly details: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

interface Envelope<T> {
  data?: T
  error?: { code: string; message: string; details?: unknown }
}

export interface SendOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

export async function send<T>(path: string, { method = 'GET', body, headers, signal }: SendOptions = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      signal,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'NETWORK', 'API unreachable')
  }
  const parsed = (await res.json().catch(() => null)) as Envelope<T> | null
  if (!res.ok || !parsed || parsed.data === undefined) {
    throw new ApiError(res.status, parsed?.error?.code ?? 'BAD_RESPONSE', parsed?.error?.message ?? res.statusText, parsed?.error?.details)
  }
  return parsed.data
}

export function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  return send<T>(path, { signal })
}

export const api = {
  stores: (geo: GeoPoint, signal?: AbortSignal) =>
    request<StoreWithDelivery[]>(`/stores?lat=${geo.lat}&lng=${geo.lng}`, signal),
  store: (id: string, geo: GeoPoint, signal?: AbortSignal) =>
    request<StoreWithDelivery>(`/stores/${encodeURIComponent(id)}?lat=${geo.lat}&lng=${geo.lng}`, signal),
  towns: (signal?: AbortSignal) => request<Town[]>('/locations', signal),
  pincode: (townId: string, pincode: string, signal?: AbortSignal) =>
    request<{ result: PincodeCheck }>(
      `/locations/pincode?townId=${encodeURIComponent(townId)}&pincode=${encodeURIComponent(pincode)}`,
      signal,
    ),
}
