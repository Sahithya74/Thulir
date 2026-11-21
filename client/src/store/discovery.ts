import { create } from 'zustand'
import type { StoreCategory } from '@thulir/shared'

export type DiscoveryView = 'arc' | 'immersive' | 'list' | 'map'

interface DiscoveryState {
  view: DiscoveryView
  setView: (v: DiscoveryView) => void
  query: string
  setQuery: (q: string) => void
  categories: StoreCategory[]
  toggleCategory: (c: StoreCategory) => void
  openNow: boolean
  fast: boolean
  offers: boolean
  nearby: boolean
  toggleFlag: (k: 'openNow' | 'fast' | 'offers' | 'nearby') => void
  clearFilters: () => void
  selectedId: string | null
  hoveredId: string | null
  select: (id: string | null) => void
  hover: (id: string | null) => void
}

export const useDiscovery = create<DiscoveryState>((set) => ({
  view: 'arc',
  setView: (view) => set({ view }),
  query: '',
  setQuery: (query) => set({ query }),
  categories: [],
  toggleCategory: (c) =>
    set((s) => ({
      categories: s.categories.includes(c) ? s.categories.filter((x) => x !== c) : [...s.categories, c],
    })),
  openNow: false,
  fast: false,
  offers: false,
  nearby: false,
  toggleFlag: (k) => set((s) => ({ [k]: !s[k] }) as Pick<DiscoveryState, typeof k>),
  clearFilters: () =>
    set({ query: '', categories: [], openNow: false, fast: false, offers: false, nearby: false }),
  selectedId: null,
  hoveredId: null,
  select: (selectedId) => set({ selectedId }),
  hover: (hoveredId) => set({ hoveredId }),
}))
