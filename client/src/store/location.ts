import { create } from 'zustand'
import { demoTowns, findArea, type SavedAddress, type Town, type UserLocation } from '@thulir/shared'

const LOC_KEY = 'thulir.location'
const ADDR_KEY = 'thulir.addresses'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable (private mode etc.) — the app still works, it just forgets */
  }
}

/** Defensive: stored data may be stale or hand-edited. Anything that does not resolve is dropped. */
function validLocation(l: UserLocation | null, towns: Town[]): UserLocation | null {
  if (!l || typeof l.geo?.lat !== 'number' || typeof l.geo?.lng !== 'number') return null
  if (!towns.some((t) => t.id === l.townId)) return null
  return l
}

function validAddresses(list: SavedAddress[] | null, towns: Town[]): SavedAddress[] {
  if (!Array.isArray(list)) return []
  return list.filter((a) => a && typeof a.id === 'string' && findArea(towns, a.areaId))
}

interface LocationState {
  towns: Town[]
  setTowns: (t: Town[]) => void
  location: UserLocation | null
  setLocation: (l: UserLocation) => void
  clearLocation: () => void
  addresses: SavedAddress[]
  saveAddress: (a: Omit<SavedAddress, 'id'>) => SavedAddress
  removeAddress: (id: string) => void
  pickerOpen: boolean
  openPicker: () => void
  closePicker: () => void
}

export const useLocation = create<LocationState>((set, get) => ({
  towns: demoTowns,
  setTowns: (towns) => set({ towns }),
  location: validLocation(read<UserLocation>(LOC_KEY), demoTowns),
  setLocation: (location) => {
    write(LOC_KEY, location)
    set({ location, pickerOpen: false })
  },
  clearLocation: () => {
    write(LOC_KEY, null)
    set({ location: null })
  },
  addresses: validAddresses(read<SavedAddress[]>(ADDR_KEY), demoTowns),
  saveAddress: (a) => {
    const saved: SavedAddress = { ...a, id: `addr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` }
    const addresses = [saved, ...get().addresses].slice(0, 8)
    write(ADDR_KEY, addresses)
    set({ addresses })
    return saved
  },
  removeAddress: (id) => {
    const addresses = get().addresses.filter((a) => a.id !== id)
    write(ADDR_KEY, addresses)
    set({ addresses })
  },
  pickerOpen: false,
  openPicker: () => set({ pickerOpen: true }),
  closePicker: () => set({ pickerOpen: false }),
}))
