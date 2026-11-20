import { create } from 'zustand'
import { demoStores, demoTowns, withDeliveryAll, type GeoPoint, type StoreWithDelivery } from '@thulir/shared'
import { api } from '@/services/api'

export type StoresSource = 'api' | 'local'

interface StoresState {
  stores: StoreWithDelivery[]
  /** `api` when the server computed delivery; `local` when the API was unreachable and shared demo logic was used. */
  source: StoresSource
  status: 'idle' | 'loading' | 'ready'
  load: (geo: GeoPoint) => Promise<void>
}

let inflight: AbortController | null = null

export const useStores = create<StoresState>((set) => ({
  stores: withDeliveryAll(demoStores, demoTowns[0].center),
  source: 'local',
  status: 'idle',
  load: async (geo) => {
    inflight?.abort()
    const ctrl = new AbortController()
    inflight = ctrl
    set({ status: 'loading' })
    try {
      const stores = await api.stores(geo, ctrl.signal)
      if (!ctrl.signal.aborted) set({ stores, source: 'api', status: 'ready' })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      // Offline fallback: same pure delivery function the server uses.
      set({ stores: withDeliveryAll(demoStores, geo), source: 'local', status: 'ready' })
    }
  },
}))
