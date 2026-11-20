import { demoStores, type Store } from '@thulir/shared'

/**
 * Persistence boundary for stores. `list` / `findById` are what customers may see: ACTIVE stores only. A suspended
 * store disappears from the shop, from search and from checkout in one place, here.
 */
export interface StoreRepository {
  list(): Promise<Store[]>
  findById(id: string): Promise<Store | null>
  /** Every store including suspended ones (admin and owner tooling). */
  listAll(): Promise<Store[]>
  findAny(id: string): Promise<Store | null>
  setStatus(id: string, status: 'active' | 'suspended'): Promise<Store | null>
}

const active = (s: Store) => (s.status ?? 'active') === 'active'

export class InMemoryStoreRepository implements StoreRepository {
  // A private copy, so suspending a store never mutates the shared fixtures other code imports.
  private readonly stores: Store[] = demoStores.map((s) => ({ ...s, status: 'active' as const }))

  async list() {
    return this.stores.filter(active)
  }
  async findById(id: string) {
    return this.stores.find((s) => s.id === id && active(s)) ?? null
  }
  async listAll() {
    return this.stores
  }
  async findAny(id: string) {
    return this.stores.find((s) => s.id === id) ?? null
  }
  async setStatus(id: string, status: 'active' | 'suspended') {
    const s = this.stores.find((x) => x.id === id)
    if (!s) return null
    s.status = status
    return s
  }
}
