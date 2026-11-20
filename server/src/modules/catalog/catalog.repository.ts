import {
  buildDemoCatalog,
  resolvePolicy,
  type Batch,
  type Department,
  type ExpiryPolicy,
  type PolicyOverrides,
  type Product,
} from '@thulir/shared'

export interface Allocation {
  batchId: string
  qty: number
}

/** Append-only record of every stock change. */
export interface InventoryMovement {
  at: string
  batchId: string
  /** Negative when stock leaves, positive when it arrives or returns. */
  delta: number
  reason: 'order_reserve' | 'order_release' | 'owner_receive' | 'owner_adjust'
  /** What caused it: an order id, or the acting user's id. */
  ref: string
  note?: string
}

/** Persistence boundary for products, batches and expiry policy. A MySQL implementation arrives later. */
export interface CatalogRepository {
  snapshot(): { products: Product[]; batches: Batch[] }
  /** All-or-nothing: takes every allocation or none. False if any batch cannot cover its share. */
  reserve(allocations: Allocation[], ref: string, at: Date): boolean
  release(allocations: Allocation[], ref: string, at: Date): void
  movements(): readonly InventoryMovement[]

  findProduct(id: string): Product | undefined
  findBatch(id: string): Batch | undefined
  addProduct(p: Product): void
  /** Replace the stored product with `next` (callers validate first). */
  saveProduct(next: Product): void
  addBatch(b: Batch, at: Date, ref: string): void
  saveBatch(next: Batch): void
  /** Change on-hand quantity by `delta` and log it. Callers have already checked the result is not negative. */
  adjustBatchQty(batchId: string, delta: number, ref: string, note: string, at: Date): void

  overridesFor(storeId: string): PolicyOverrides
  setDepartmentPolicy(storeId: string, department: Department, patch: Partial<ExpiryPolicy>): void
  /** Only what the store itself chose (no platform defaults). */
  storeChoices(storeId: string): PolicyOverrides
  /** Platform-wide department defaults set by an admin. Store choices sit on top of these. */
  platformPolicies(): Partial<Record<Department, Partial<ExpiryPolicy>>>
  setPlatformPolicy(department: Department, patch: Partial<ExpiryPolicy>): void
  /** The policy actually in force for a product (platform → department → store → product). */
  policyFor(product: Product): ExpiryPolicy
}

/**
 * Demo stock is "received" when the repository is created; expiry dates are fixed from then on. Because freshness is
 * evaluated per request against the live clock, items genuinely expire while the server keeps running.
 *
 * Reservation is synchronous (no awaits between check and write), so in a single Node process two orders can never
 * both claim the last unit. A database implementation must use a transaction / row lock to keep that guarantee.
 */
export class InMemoryCatalogRepository implements CatalogRepository {
  private readonly data: { products: Product[]; batches: Batch[] }
  private readonly log: InventoryMovement[] = []
  private readonly policies = new Map<string, PolicyOverrides>()
  private platform: Partial<Record<Department, Partial<ExpiryPolicy>>> = {}

  constructor(receivedAt: Date = new Date()) {
    this.data = buildDemoCatalog(receivedAt)
  }

  snapshot() {
    return this.data
  }

  findProduct(id: string) {
    return this.data.products.find((p) => p.id === id)
  }
  findBatch(id: string) {
    return this.data.batches.find((b) => b.id === id)
  }
  addProduct(p: Product) {
    this.data.products.push(p)
  }
  saveProduct(next: Product) {
    const i = this.data.products.findIndex((p) => p.id === next.id)
    if (i >= 0) this.data.products[i] = next
  }
  addBatch(b: Batch, at: Date, ref: string) {
    this.data.batches.push(b)
    if (b.qty > 0) this.log.push({ at: at.toISOString(), batchId: b.id, delta: b.qty, reason: 'owner_receive', ref })
  }
  saveBatch(next: Batch) {
    const i = this.data.batches.findIndex((b) => b.id === next.id)
    if (i >= 0) this.data.batches[i] = next
  }
  adjustBatchQty(batchId: string, delta: number, ref: string, note: string, at: Date) {
    const b = this.findBatch(batchId)
    if (!b) return
    b.qty += delta
    this.log.push({ at: at.toISOString(), batchId, delta, reason: 'owner_adjust', ref, note })
  }

  reserve(allocations: Allocation[], ref: string, at: Date): boolean {
    const byId = new Map(this.data.batches.map((b) => [b.id, b]))
    const need = new Map<string, number>()
    for (const a of allocations) need.set(a.batchId, (need.get(a.batchId) ?? 0) + a.qty)
    for (const [id, qty] of need) {
      const b = byId.get(id)
      if (!b || b.status !== 'active' || !Number.isInteger(qty) || qty < 1 || b.qty < qty) return false
    }
    for (const [id, qty] of need) {
      byId.get(id)!.qty -= qty
      this.log.push({ at: at.toISOString(), batchId: id, delta: -qty, reason: 'order_reserve', ref })
    }
    return true
  }

  release(allocations: Allocation[], ref: string, at: Date): void {
    const byId = new Map(this.data.batches.map((b) => [b.id, b]))
    for (const a of allocations) {
      const b = byId.get(a.batchId)
      if (!b) continue
      b.qty += a.qty
      this.log.push({ at: at.toISOString(), batchId: a.batchId, delta: a.qty, reason: 'order_release', ref })
    }
  }

  movements() {
    return this.log
  }

  /** Platform defaults first, then the store's own department choices on top. */
  overridesFor(storeId: string): PolicyOverrides {
    const store = this.policies.get(storeId)?.department ?? {}
    const merged: Partial<Record<Department, Partial<ExpiryPolicy>>> = {}
    for (const d of new Set([...Object.keys(this.platform), ...Object.keys(store)]) as Set<Department>) {
      merged[d] = { ...this.platform[d], ...store[d] }
    }
    return { department: merged }
  }

  /** What the store itself chose (without platform defaults), for the owner's rules page. */
  storeChoices(storeId: string): PolicyOverrides {
    return this.policies.get(storeId) ?? {}
  }

  platformPolicies() {
    return this.platform
  }

  setPlatformPolicy(department: Department, patch: Partial<ExpiryPolicy>) {
    this.platform = { ...this.platform, [department]: { ...this.platform[department], ...patch } }
  }

  setDepartmentPolicy(storeId: string, department: Department, patch: Partial<ExpiryPolicy>) {
    const cur = this.storeChoices(storeId)
    this.policies.set(storeId, { ...cur, department: { ...cur.department, [department]: { ...cur.department?.[department], ...patch } } })
  }

  policyFor(product: Product): ExpiryPolicy {
    return resolvePolicy(product, this.overridesFor(product.storeId))
  }
}
