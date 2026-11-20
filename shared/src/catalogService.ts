import { buildDemoCatalog } from './catalogData.ts'
import {
  evaluateEligibility,
  isVisibleToCustomer,
  resolvePolicy,
  sellableBatches,
  toCustomerEligibility,
  type PolicyOverrides,
} from './eligibility.ts'
import { priceStoreGroup } from './pricing.ts'
import { MISSIONS } from './missions.ts'
import { DEPARTMENT_LABEL, matchDepartments, normalise, POPULAR_SEARCHES, scoreProduct } from './search.ts'
import type {
  Batch,
  CartIssue,
  CartLineInput,
  CartLineView,
  CartStoreGroup,
  CartValidation,
  Department,
  Eligibility,
  ExpiryPolicy,
  Mission,
  MissionResult,
  Product,
  ProductView,
  SearchHit,
  Store,
  StoreCatalog,
  StoreWithDelivery,
  Suggestion,
} from './types.ts'

/** Largest quantity of one product in a single basket line. */
export const MAX_LINE_QTY = 20

const GENERIC_TAGS = new Set(['staple', 'quick', 'snack', 'dinner', 'veg', 'drink', 'new'])

export interface ProductDetail {
  hit: SearchHit
  substitutes: SearchHit[]
}

export interface CatalogService {
  storeCatalog(storeId: string): StoreCatalog | null
  /** Returns null for unknown AND for ineligible products — callers cannot tell the difference. */
  product(id: string): ProductDetail | null
  search(query: string, opts?: { limit?: number; storeId?: string }): SearchHit[]
  suggest(query: string): Suggestion[]
  popular(): readonly string[]
  missions(): Mission[]
  mission(id: string, stores: StoreWithDelivery[]): MissionResult | null
  /**
   * Price and validate a basket against live eligibility and the customer's location. The server calls this at every
   * gate (cart view, checkout, order confirmation). Prices always come from the catalog, never from the caller.
   */
  cart(lines: CartLineInput[], stores: StoreWithDelivery[]): CartValidation
  /** Draw `qty` units from sellable batches, earliest expiry first. Null if the stock is not there right now. */
  allocate(productId: string, qty: number): { batchId: string; qty: number }[] | null
  /** The policy in force for a product (platform → department → store → product), as the engine applied it. */
  policyFor(product: Product): ExpiryPolicy
  /** Full server-side verdicts, for owner/admin tooling and tests. Never sent to customers. */
  verdicts(): { product: Product; eligibility: Eligibility }[]
}

function toView(p: Product, e: Eligibility): ProductView {
  const discountPercent = p.mrpPaise > p.pricePaise ? Math.round(((p.mrpPaise - p.pricePaise) / p.mrpPaise) * 100) : 0
  return {
    id: p.id,
    storeId: p.storeId,
    department: p.department,
    name: p.name,
    brand: p.brand,
    unit: p.unit,
    pricePaise: p.pricePaise,
    mrpPaise: p.mrpPaise,
    discountPercent,
    description: p.description,
    shape: p.shape,
    color: p.color,
    tags: p.tags,
    aliases: p.aliases,
    veg: p.veg,
    isNew: Boolean(p.isNew),
    imageUrl: p.imageUrl ?? null,
    eligibility: toCustomerEligibility(e),
  }
}

/**
 * Build a catalog service for a moment in time. Eligibility is evaluated here, once per service, against `now` —
 * so every request that builds a fresh service re-validates freshness (catalog fetch, product fetch, search, missions).
 */
export function createCatalogService(
  stores: Store[],
  now: Date = new Date(),
  data: { products: Product[]; batches: Batch[] } = buildDemoCatalog(now),
  /** Owner / admin configured overrides for a store. Every evaluation and allocation honours them. */
  overridesFor: (storeId: string) => PolicyOverrides = () => ({}),
): CatalogService {
  const policyFor = (product: Product) => resolvePolicy(product, overridesFor(product.storeId))
  const storeById = new Map(stores.map((s) => [s.id, s]))
  const verdictList = data.products.map((product) => ({
    product,
    eligibility: evaluateEligibility({ product, batches: data.batches, now, policy: policyFor(product) }),
  }))
  const verdictById = new Map(verdictList.map((v) => [v.product.id, v]))
  const visible = verdictList.filter((v) => isVisibleToCustomer(v.eligibility) && storeById.has(v.product.storeId))
  const visibleById = new Map(visible.map((v) => [v.product.id, v]))

  const hitFor = (v: (typeof visible)[number], score = 0): SearchHit => {
    const s = storeById.get(v.product.storeId)!
    return { product: toView(v.product, v.eligibility), store: { id: s.id, slug: s.slug, name: s.name }, score }
  }

  const search: CatalogService['search'] = (query, opts = {}) => {
    const limit = opts.limit ?? 40
    const q = normalise(query)
    if (!q) return []
    const depts = new Set<Department>(matchDepartments(q))
    const hits: SearchHit[] = []
    for (const v of visible) {
      if (opts.storeId && v.product.storeId !== opts.storeId) continue
      const s = storeById.get(v.product.storeId)!
      let score = scoreProduct(v.product, q, s.name)
      if (score === 0 && depts.has(v.product.department)) score = 4
      if (score > 0) {
        // Sellable items outrank sold-out ones.
        hits.push(hitFor(v, score + (v.eligibility.sellable ? 0.5 : -3)))
      }
    }
    return hits.sort((a, b) => b.score - a.score || a.product.pricePaise - b.product.pricePaise).slice(0, limit)
  }

  return {
    storeCatalog(storeId) {
      if (!storeById.has(storeId)) return null
      const mine = verdictList.filter((v) => v.product.storeId === storeId)
      const shown = mine.filter((v) => isVisibleToCustomer(v.eligibility))
      const counts = new Map<Department, number>()
      for (const v of shown) counts.set(v.product.department, (counts.get(v.product.department) ?? 0) + 1)
      return {
        storeId,
        products: shown.map((v) => toView(v.product, v.eligibility)),
        departments: [...counts.entries()].map(([id, count]) => ({ id, count })),
        hiddenCount: mine.length - shown.length,
        checkedAt: now.toISOString(),
      }
    },

    product(id) {
      const v = visibleById.get(id)
      if (!v) return null
      const target = v.product
      const tagsOf = (p: Product) => p.tags.filter((t) => !GENERIC_TAGS.has(t))
      const mine = new Set(tagsOf(target))
      const subs = visible
        .filter((o) => o.eligibility.sellable && o.product.id !== target.id && o.product.department === target.department)
        .map((o) => {
          const overlap = tagsOf(o.product).filter((t) => mine.has(t)).length
          const ratio = o.product.pricePaise / target.pricePaise
          return { o, overlap, ratio }
        })
        .filter((x) => x.overlap > 0 && x.ratio >= 0.5 && x.ratio <= 1.6)
        .sort((a, b) => b.overlap - a.overlap || Math.abs(1 - a.ratio) - Math.abs(1 - b.ratio))
        .slice(0, 3)
        .map((x) => hitFor(x.o))
      return { hit: hitFor(v), substitutes: subs }
    },

    search,

    suggest(query) {
      const q = normalise(query)
      if (q.length < 1) return []
      const out: Suggestion[] = []
      for (const h of search(q, { limit: 4 })) {
        out.push({ kind: 'product', text: `${h.product.name.en} · ${h.product.unit}`, productId: h.product.id, storeSlug: h.store.slug })
      }
      const brands = new Set<string>()
      for (const v of visible) if (normalise(v.product.brand).startsWith(q)) brands.add(v.product.brand)
      for (const b of [...brands].slice(0, 2)) out.push({ kind: 'brand', text: b })
      for (const d of matchDepartments(q).slice(0, 2)) out.push({ kind: 'department', text: DEPARTMENT_LABEL[d].en, department: d })
      return out
    },

    popular: () => POPULAR_SEARCHES,
    missions: () => MISSIONS,

    mission(id, deliverStores) {
      const mission = MISSIONS.find((m) => m.id === id)
      if (!mission) return null
      const reachable = new Map(deliverStores.filter((s) => s.delivery.deliverable).map((s) => [s.id, s]))
      const pool = visible.filter((v) => v.eligibility.sellable && reachable.has(v.product.storeId))

      const matches = (p: Product) => {
        if (mission.onlyNew) return Boolean(p.isNew)
        const byTag = mission.anyTags?.some((t) => p.tags.includes(t)) ?? false
        const byDept = mission.departments?.includes(p.department) ?? false
        return byTag || byDept
      }

      const groups = new Map<string, ProductView[]>()
      if (!mission.meals) {
        for (const v of pool.filter((x) => matches(x.product))) {
          groups.set(v.product.storeId, [...(groups.get(v.product.storeId) ?? []), toView(v.product, v.eligibility)])
        }
      }
      const groupList = [...groups.entries()]
        .map(([storeId, products]) => {
          const s = reachable.get(storeId)!
          return {
            store: { id: s.id, slug: s.slug, name: s.name, etaMin: s.delivery.etaMin, distanceM: s.delivery.distanceM },
            products: products.sort((a, b) => a.pricePaise - b.pricePaise),
          }
        })
        .sort((a, b) => a.store.distanceM - b.store.distanceM)

      const meals = (mission.meals ?? []).map((meal) => ({
        meal,
        items: meal.ingredients.map((tag) => {
          const best = pool
            .filter((v) => v.product.tags.includes(tag))
            .sort((a, b) => a.product.pricePaise - b.product.pricePaise)[0]
          return {
            tag,
            product: best ? toView(best.product, best.eligibility) : null,
            storeSlug: best ? storeById.get(best.product.storeId)!.slug : null,
          }
        }),
      }))

      return { mission, groups: groupList, meals }
    },

    cart(inputLines, deliveryStores) {
      const reach = new Map(deliveryStores.map((s) => [s.id, s]))
      const requestedBy = new Map<string, number>()
      for (const l of inputLines) {
        // Never coerce: a fractional or non-numeric quantity is malformed input and is rejected below, not rounded.
        const n = typeof l.qty === 'number' ? l.qty : NaN
        requestedBy.set(l.productId, (requestedBy.get(l.productId) ?? 0) + n)
      }

      const issues: CartIssue[] = []
      const byStore = new Map<string, CartLineView[]>()

      for (const [productId, requested] of requestedBy) {
        const v = verdictById.get(productId)
        if (!v) {
          const unknown = { en: 'Unknown item', ta: 'Unknown item' }
          issues.push({ productId, name: unknown, issue: 'UNAVAILABLE', requestedQty: requested, allowedQty: 0 })
          continue
        }
        const view = toView(v.product, v.eligibility)
        const store = storeById.has(v.product.storeId) ? reach.get(v.product.storeId) : undefined
        const storeGone = !storeById.has(v.product.storeId) // e.g. suspended: not offered to customers at all
        let status: CartLineView['status'] = 'ok'
        let qty = requested
        let issue: CartLineView['issue']

        if (!Number.isInteger(requested) || requested < 1 || requested > MAX_LINE_QTY) {
          status = 'removed'
          issue = 'INVALID_QTY'
          qty = 0
        } else if (storeGone) {
          status = 'removed'
          issue = 'UNAVAILABLE'
          qty = 0
        } else if (!store || !store.delivery.deliverable) {
          status = 'removed'
          issue = 'NOT_DELIVERABLE'
          qty = 0
        } else if (!v.eligibility.sellable) {
          status = 'removed'
          issue = v.eligibility.status === 'out_of_stock' ? 'OUT_OF_STOCK' : 'UNAVAILABLE'
          qty = 0
        } else if (requested > v.eligibility.sellableQty) {
          status = 'adjusted'
          issue = 'QTY_REDUCED'
          qty = v.eligibility.sellableQty
        }

        if (issue) issues.push({ productId, name: v.product.name, issue, requestedQty: requested, allowedQty: qty })
        if (!store) continue
        const line: CartLineView = { product: view, requestedQty: requested, qty, lineTotalPaise: view.pricePaise * qty, status, issue }
        byStore.set(store.id, [...(byStore.get(store.id) ?? []), line])
      }

      const groups: CartStoreGroup[] = []
      for (const [storeId, lines] of byStore) {
        const s = reach.get(storeId)!
        groups.push(
          priceStoreGroup(
            s,
            { id: s.id, slug: s.slug, name: s.name, etaMin: s.delivery.etaMin, distanceM: s.delivery.distanceM, deliverable: s.delivery.deliverable, freeDeliveryAbovePaise: s.freeDeliveryAbovePaise },
            lines,
          ),
        )
      }
      groups.sort((a, b) => a.store.distanceM - b.store.distanceM)
      const live = groups.filter((g) => g.itemCount > 0)

      const sum = (f: (g: CartStoreGroup) => number) => groups.reduce((n, g) => n + f(g), 0)
      return {
        groups,
        issues,
        itemCount: sum((g) => g.itemCount),
        subtotalPaise: sum((g) => g.subtotalPaise),
        discountPaise: sum((g) => g.offerDiscountPaise),
        deliveryPaise: sum((g) => g.deliveryFeePaise),
        taxPaise: sum((g) => g.taxPaise),
        totalPaise: sum((g) => g.totalPaise),
        multiDelivery: live.length > 1,
        canCheckout: live.length > 0 && issues.length === 0,
        checkedAt: now.toISOString(),
      }
    },

    allocate(productId, qty) {
      const v = verdictById.get(productId)
      if (!v || !Number.isInteger(qty) || qty < 1) return null
      // Product-level switches (owner off, flagged for removal, ...) apply to reservation exactly as to the catalog.
      if (!v.eligibility.sellable || qty > v.eligibility.sellableQty) return null
      let need = qty
      const out: { batchId: string; qty: number }[] = []
      for (const sb of sellableBatches(v.product, data.batches, now, policyFor(v.product))) {
        const take = Math.min(need, sb.qty)
        if (take > 0) {
          out.push({ batchId: sb.batch.id, qty: take })
          need -= take
        }
        if (need === 0) break
      }
      return need === 0 ? out : null
    },

    policyFor,
    verdicts: () => verdictList,
  }
}
