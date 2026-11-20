import {
  buildDemoCatalog,
  createCatalogService,
  demoStores,
  withDeliveryAll,
  type CatalogService,
  type GeoPoint,
  type Mission,
  type MissionResult,
  type ProductDetail,
  type SearchHit,
  type StoreCatalog,
  type Suggestion,
} from '@thulir/shared'
import { ApiError, request } from './api'

export type DataSource = 'api' | 'local'
export interface Sourced<T> {
  data: T
  source: DataSource
}

/**
 * Offline fallback: the same shared logic the server runs, over the bundled demo stock. It is only used when the API is
 * unreachable (network failure). A real HTTP answer — including a 404 for a product the server has hidden — is never
 * second-guessed locally.
 */
let localData: ReturnType<typeof buildDemoCatalog> | null = null
function local(): CatalogService {
  localData ??= buildDemoCatalog(new Date())
  return createCatalogService(demoStores, new Date(), localData)
}

async function sourced<T>(remote: () => Promise<T>, fallback: () => T): Promise<Sourced<T>> {
  try {
    return { data: await remote(), source: 'api' }
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) return { data: fallback(), source: 'local' }
    throw e
  }
}

const q = encodeURIComponent

export const catalogApi = {
  storeCatalog: (storeId: string, signal?: AbortSignal) =>
    sourced(
      () => request<StoreCatalog>(`/stores/${q(storeId)}/catalog`, signal),
      () => {
        const c = local().storeCatalog(storeId)
        if (!c) throw new ApiError(404, 'STORE_NOT_FOUND', 'Store not found')
        return c
      },
    ),

  product: (id: string, signal?: AbortSignal) =>
    sourced(
      () => request<ProductDetail>(`/products/${q(id)}`, signal),
      () => {
        const d = local().product(id)
        if (!d) throw new ApiError(404, 'PRODUCT_NOT_AVAILABLE', 'This product is not available')
        return d
      },
    ),

  search: (query: string, opts: { limit?: number; storeId?: string } = {}, signal?: AbortSignal) =>
    sourced(
      () =>
        request<SearchHit[]>(
          `/search?q=${q(query)}${opts.limit ? `&limit=${opts.limit}` : ''}${opts.storeId ? `&storeId=${q(opts.storeId)}` : ''}`,
          signal,
        ),
      () => local().search(query, opts),
    ),

  suggest: (query: string, signal?: AbortSignal) =>
    sourced(
      () => request<Suggestion[]>(`/search/suggest?q=${q(query)}`, signal),
      () => local().suggest(query),
    ),

  popular: (signal?: AbortSignal) =>
    sourced(
      () => request<string[]>('/search/popular', signal),
      () => [...local().popular()],
    ),

  missions: (signal?: AbortSignal) =>
    sourced(
      () => request<Mission[]>('/missions', signal),
      () => local().missions(),
    ),

  mission: (id: string, geo: GeoPoint, signal?: AbortSignal) =>
    sourced(
      () => request<MissionResult>(`/missions/${q(id)}?lat=${geo.lat}&lng=${geo.lng}`, signal),
      () => {
        const r = local().mission(id, withDeliveryAll(demoStores, geo))
        if (!r) throw new ApiError(404, 'MISSION_NOT_FOUND', 'Mission not found')
        return r
      },
    ),
}
