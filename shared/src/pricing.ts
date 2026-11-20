import type { AppliedOffer, CartLineView, CartStoreGroup, CartStoreInfo, Offer, Product, ProductView, Store } from './types.ts'

/**
 * Pricing, in integer paise throughout. This is a pure function so the server (authoritative) and the client
 * (offline fallback only) can never disagree about arithmetic. The client never sends a price: it sends product ids
 * and quantities, and the server prices them.
 *
 * Prototype rules (simulated):
 *  - Product prices are MRP-inclusive of taxes, so tax shown is always 0.
 *  - Percent offers apply to the qualifying items; flat offers to the store subtotal once its minimum is reached.
 *  - Delivery is free once the store's discounted subtotal reaches its free-delivery threshold.
 */
export function priceStoreGroup(store: Store, info: CartStoreInfo, lines: CartLineView[]): CartStoreGroup {
  const buyable = lines.filter((l) => l.status !== 'removed' && l.qty > 0)
  const subtotalPaise = buyable.reduce((n, l) => n + l.lineTotalPaise, 0)
  const mrpSavingsPaise = buyable.reduce((n, l) => n + Math.max(0, l.product.mrpPaise - l.product.pricePaise) * l.qty, 0)

  const appliedOffers: AppliedOffer[] = []
  let offerDiscountPaise = 0
  for (const o of store.offers) {
    const amount = offerAmount(o, buyable, subtotalPaise)
    if (amount > 0) {
      const room = subtotalPaise - offerDiscountPaise
      const capped = Math.min(amount, room)
      if (capped > 0) {
        appliedOffers.push({ id: o.id, label: o.label, amountPaise: capped })
        offerDiscountPaise += capped
      }
    }
  }

  const discounted = subtotalPaise - offerDiscountPaise
  let deliveryFeePaise = 0
  let freeDeliveryRemainingPaise: number | null = null
  if (buyable.length > 0) {
    if (discounted >= store.freeDeliveryAbovePaise) {
      deliveryFeePaise = 0
    } else {
      deliveryFeePaise = store.deliveryFeePaise
      freeDeliveryRemainingPaise = store.freeDeliveryAbovePaise - discounted
    }
  }

  return {
    store: info,
    lines,
    itemCount: buyable.reduce((n, l) => n + l.qty, 0),
    subtotalPaise,
    mrpSavingsPaise,
    offerDiscountPaise,
    appliedOffers,
    deliveryFeePaise,
    freeDeliveryRemainingPaise,
    taxPaise: 0,
    totalPaise: discounted + deliveryFeePaise,
  }
}

function offerAmount(o: Offer, lines: CartLineView[], subtotal: number): number {
  if (o.minSubtotalPaise !== undefined && subtotal < o.minSubtotalPaise) return 0
  if (o.kind === 'flat' && o.flatPaise) return o.flatPaise
  if (o.kind === 'percent' && o.percent) {
    const base = lines
      .filter((l) => matches(o, l.product))
      .reduce((n, l) => n + l.lineTotalPaise, 0)
    return Math.floor((base * o.percent) / 100)
  }
  return 0 // free_delivery offers are informational; the threshold rule above does the work
}

function matches(o: Offer, p: Pick<ProductView, 'tags' | 'department'> | Pick<Product, 'tags' | 'department'>): boolean {
  if (o.appliesToTag && !p.tags.includes(o.appliesToTag)) return false
  if (o.appliesToDepartment && p.department !== o.appliesToDepartment) return false
  return true
}
