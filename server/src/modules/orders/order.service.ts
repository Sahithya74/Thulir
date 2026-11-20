import { createHash, randomBytes, randomInt } from 'node:crypto'
import {
  checkPincode,
  classifyBatch,
  createCatalogService,
  demoTowns,
  findArea,
  canTransition,
  isTerminal,
  istDate,
  isSlotAllowed,
  nextSteps,
  slotLabel,
  withDeliveryAll,
  type Actor as MachineActor,
  type CartLineInput,
  type OrderView,
  type AdminOrderRow,
  type OwnerStoreOrderView,
  type PartnerOrderView,
  type StoreOrderStatus,
  type UserRole,
  type PaymentMethodId,
  type SlotChoice,
  type StoreWithDelivery,
} from '@thulir/shared'
import { AppError } from '../../middleware/errors.js'
import type { CatalogRepository, Allocation } from '../catalog/catalog.repository.js'
import type { AuditLog } from '../audit/audit.repository.js'
import type { PaymentService } from '../payments/payment.service.js'
import type { StoreRepository } from '../stores/store.repository.js'
import type { OrderRepository } from './order.repository.js'
import type { OrderRecord, OrderItemRecord, StoreOrderRecord } from './order.types.js'

/** How long stock is held for a prepaid order whose payment has not been completed. */
export const RESERVATION_MINUTES = 15
/** After this many failed payment attempts the order is cancelled and its stock returned. */
export const MAX_PAYMENT_ATTEMPTS = 5

export interface CreateOrderInput {
  lines: CartLineInput[]
  address: { name: string; phone: string; line1: string; areaId: string; pincode: string; instructions: string }
  slot: SlotChoice
  paymentMethod: PaymentMethodId
  idempotencyKey: string
}

export interface OrderService {
  create(ownerToken: string, input: CreateOrderInput): Promise<OrderView>
  get(ownerToken: string, id: string): OrderView
  list(ownerToken: string): OrderView[]
  simulatePayment(ownerToken: string, id: string, outcome: 'success' | 'failure'): OrderView
  cancel(ownerToken: string, id: string): OrderView
  /** Orders (that have been confirmed) containing items from this store, newest first. */
  listForStore(storeId: string): OwnerStoreOrderView[]
  /**
   * Move a store order one step along the state machine. The machine decides what is allowed for `as`; callers only
   * choose the step. Nothing else in the codebase writes an order status.
   */
  transition(input: TransitionInput): OwnerStoreOrderView
  /** Orders assigned to this delivery partner (active and finished). */
  listForPartner(partnerId: string): Promise<PartnerOrderView[]>
  /** Every confirmed store order, for platform support. */
  listForAdmin(): AdminOrderRow[]
}

export interface TransitionInput {
  /** Set for store actions: the order must belong to this store. */
  storeId?: string
  /** Set for delivery actions: the order must be assigned to this partner. */
  partnerId?: string
  /** The customer's handover code, required to mark an order delivered. */
  code?: string
  storeOrderId: string
  to: StoreOrderStatus
  as: MachineActor
  actor: { id: string; name: string; role: UserRole | 'system' }
  reason?: string
}

interface Deps {
  stores: StoreRepository
  catalog: CatalogRepository
  orders: OrderRepository
  payments: PaymentService
  audit: AuditLog
  clock: () => Date
  /** Called once when an order becomes real (confirmed). Used to notify the stores involved. */
  onConfirmed?: (order: OrderRecord) => void
  /** Pick a delivery partner when a store marks an order ready. Null if nobody is available. */
  assignPartner?: (storeId: string) => { id: string; name: string } | null
}

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')

function newOrderId(exists: (id: string) => boolean): string {
  for (;;) {
    const id = `TH-${randomBytes(5).toString('hex').toUpperCase().slice(0, 8)}`
    if (!exists(id)) return id
  }
}

export function toOrderView(o: OrderRecord, methodLabel: string, simulated: boolean): OrderView {
  return {
    id: o.id,
    status: o.status,
    createdAt: o.createdAt,
    confirmedAt: o.confirmedAt,
    cancelReason: o.cancelReason,
    reservationExpiresAt: o.reservationExpiresAt,
    address: o.address,
    slotLabel: o.slotLabel,
    multiDelivery: o.storeOrders.length > 1,
    subtotalPaise: o.subtotalPaise,
    discountPaise: o.discountPaise,
    deliveryPaise: o.deliveryPaise,
    taxPaise: 0,
    totalPaise: o.totalPaise,
    storeOrders: o.storeOrders.map((s) => ({
      id: s.id,
      store: { id: s.storeId, slug: s.storeSlug, name: s.storeName },
      status: s.status,
      history: s.history.map((h) => ({ status: h.status, at: h.at })),
      rejectReason: s.rejectReason,
      refundSimulatedPaise: s.refundSimulatedPaise,
      deliveryCode: s.status === 'handed_over' || s.status === 'out_for_delivery' ? s.deliveryCode : null,
      partnerName: s.partnerName ? s.partnerName.split(' ')[0] : null,
      subtotalPaise: s.subtotalPaise,
      offerDiscountPaise: s.offerDiscountPaise,
      deliveryFeePaise: s.deliveryFeePaise,
      totalPaise: s.totalPaise,
      etaMin: s.etaMin,
      items: s.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        brand: i.brand,
        unit: i.unit,
        pricePaise: i.pricePaise,
        qty: i.qty,
        lineTotalPaise: i.pricePaise * i.qty,
      })),
    })),
    payment: {
      method: o.payment.method,
      methodLabel,
      simulated,
      status: o.payment.status,
      amountPaise: o.payment.amountPaise,
      attempts: o.payment.attempts,
    },
  }
}

export const MAX_CODE_ATTEMPTS = 5

export function createOrderService({ stores, catalog, orders, payments, audit, clock, onConfirmed, assignPartner }: Deps): OrderService {
  const view = (o: OrderRecord) => {
    const info = payments.info(o.payment.method)
    return toOrderView(o, info.label, info.simulated)
  }

  const allAllocations = (o: OrderRecord): Allocation[] => o.storeOrders.flatMap((s) => s.items.flatMap((i) => i.allocations))

  /** Return held stock and close the order. Idempotent: an already-cancelled order is left alone. */
  function cancelRecord(o: OrderRecord, reason: string, now: Date) {
    if (o.status === 'cancelled') return
    catalog.release(allAllocations(o), o.id, now)
    o.status = 'cancelled'
    o.cancelReason = reason
    o.reservationExpiresAt = null
    o.payment.status = 'void'
    for (const s of o.storeOrders) {
      s.status = 'cancelled'
      s.history.push({ status: 'cancelled', at: now.toISOString(), by: 'system' })
    }
  }

  /** Lazily release stock held by abandoned prepaid orders. Called at the start of every order operation. */
  function expireReservations(now: Date) {
    for (const o of orders.awaitingPayment()) {
      if (o.reservationExpiresAt && Date.parse(o.reservationExpiresAt) <= now.getTime()) cancelRecord(o, 'payment_timeout', now)
    }
  }

  /**
   * The last gate before an order becomes real. Stock was reserved earlier, so this does not look at quantities; it
   * asks whether each reserved batch is STILL a batch we may sell from (not expired overnight, not blocked since),
   * and whether the product itself is still on sale. Uses the same per-batch rule as the catalog.
   */
  function reservedStockStillSellable(o: OrderRecord, now: Date): boolean {
    const snap = catalog.snapshot()
    const today = istDate(now)
    const products = new Map(snap.products.map((p) => [p.id, p]))
    const batches = new Map(snap.batches.map((b) => [b.id, b]))
    for (const s of o.storeOrders) {
      for (const item of s.items) {
        const p = products.get(item.productId)
        if (!p || !p.available || p.flaggedForRemoval) return false
        const pol = catalog.policyFor(p)
        for (const a of item.allocations) {
          const b = batches.get(a.batchId)
          if (!b || classifyBatch(p, b, today, pol).kind !== 'sellable') return false
        }
      }
    }
    return true
  }

  function confirmRecord(o: OrderRecord, now: Date): boolean {
    if (!reservedStockStillSellable(o, now)) {
      cancelRecord(o, 'items_unavailable', now)
      return false
    }
    o.status = 'confirmed'
    o.confirmedAt = now.toISOString()
    o.reservationExpiresAt = null
    for (const s of o.storeOrders) {
      s.status = 'placed'
      s.history.push({ status: 'placed', at: now.toISOString(), by: 'customer' })
    }
    onConfirmed?.(o)
    return true
  }

  const owned = (ownerToken: string, id: string): OrderRecord => {
    const o = orders.byId(id)
    // Wrong owner and unknown order look identical, so ids cannot be probed.
    if (!o || o.ownerHash !== hashToken(ownerToken)) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
    return o
  }

  const ownerView = (o: OrderRecord, so: StoreOrderRecord): OwnerStoreOrderView => ({
    id: so.id,
    orderId: o.id,
    status: so.status,
    createdAt: o.confirmedAt ?? o.createdAt,
    slotLabel: o.slotLabel,
    paymentLabel: payments.info(o.payment.method).label,
    paymentStatus: o.payment.status,
    // Owners get what they need to pack the order: a first name and the area, not a phone number or street address.
    customerFirstName: o.address.name.split(' ')[0] ?? '',
    area: o.address.area,
    instructions: o.address.instructions,
    items: so.items.map((i) => ({ productId: i.productId, name: i.name, brand: i.brand, unit: i.unit, qty: i.qty, pricePaise: i.pricePaise })),
    subtotalPaise: so.subtotalPaise,
    offerDiscountPaise: so.offerDiscountPaise,
    deliveryFeePaise: so.deliveryFeePaise,
    totalPaise: so.totalPaise,
    rejectReason: so.rejectReason,
    nextSteps: nextSteps(so.status, 'store'),
  })

  /**
   * A store order inside a confirmed order that this caller may touch, or undefined. A store only finds its own
   * orders and a partner only finds orders assigned to them, so a foreign id is simply "not found".
   */
  function findStoreOrder(storeOrderId: string, scope: { storeId?: string; partnerId?: string }) {
    for (const order of orders.all()) {
      if (order.confirmedAt === null) continue
      const so = order.storeOrders.find(
        (x) => x.id === storeOrderId && (scope.storeId === undefined || x.storeId === scope.storeId) && (scope.partnerId === undefined || x.partnerId === scope.partnerId),
      )
      if (so) return { order, so }
    }
    return undefined
  }

  return {
    async create(ownerToken, input) {
      const now = clock()
      expireReservations(now)
      const ownerHash = hashToken(ownerToken)

      const fingerprint = JSON.stringify([input.lines, input.paymentMethod, input.address.areaId, input.address.pincode, input.slot])
      const prior = orders.findByKey(ownerHash, input.idempotencyKey)
      if (prior) {
        if (prior.fingerprint !== fingerprint) {
          throw new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'This request key was already used for a different order')
        }
        return view(prior) // a retried request: same order, no second reservation, no second charge
      }

      const town = demoTowns.find((t) => t.areas.some((a) => a.id === input.address.areaId))
      const area = town && findArea(demoTowns, input.address.areaId)
      if (!town || !area) throw new AppError(422, 'INVALID_AREA', 'Unknown delivery area')
      if (checkPincode(town, input.address.pincode) !== 'ok') {
        throw new AppError(422, 'PINCODE_NOT_SERVICEABLE', 'We do not deliver to this pincode')
      }

      const allStores = await stores.list() // the only await: everything below runs without yielding
      const withDelivery: StoreWithDelivery[] = withDeliveryAll(allStores, area.geo)
      const svc = createCatalogService(allStores, now, catalog.snapshot(), (id) => catalog.overridesFor(id))

      // Gate 1: price and validate the basket against live eligibility. Prices come from the catalog, never the client.
      const validation = svc.cart(input.lines, withDelivery)
      if (!validation.canCheckout) throw new AppError(409, 'CART_CHANGED', 'Your basket changed. Please review it.', validation)

      const hoursOf = validation.groups.map((g) => allStores.find((s) => s.id === g.store.id)!.hours)
      if (!isSlotAllowed(input.slot, hoursOf, now)) throw new AppError(422, 'SLOT_UNAVAILABLE', 'That delivery slot is not available')

      // Gate 2: take the stock, first-expiry-first-out. All or nothing.
      const orderId = newOrderId((id) => orders.byId(id) !== undefined)
      const storeOrders: StoreOrderRecord[] = []
      const everyAllocation: Allocation[] = []
      for (const [n, g] of validation.groups.entries()) {
        const items: OrderItemRecord[] = []
        for (const l of g.lines) {
          const allocations = svc.allocate(l.product.id, l.qty)
          if (!allocations) throw new AppError(409, 'CART_CHANGED', 'Your basket changed. Please review it.', svc.cart(input.lines, withDelivery))
          everyAllocation.push(...allocations)
          items.push({
            productId: l.product.id,
            name: l.product.name,
            brand: l.product.brand,
            unit: l.product.unit,
            pricePaise: l.product.pricePaise,
            mrpPaise: l.product.mrpPaise,
            qty: l.qty,
            allocations,
          })
        }
        storeOrders.push({
          id: `${orderId}-${n + 1}`,
          storeId: g.store.id,
          storeSlug: g.store.slug,
          storeName: g.store.name,
          status: 'placed',
          history: [],
          rejectReason: null,
          refundSimulatedPaise: 0,
          partnerId: null,
          partnerName: null,
          deliveryCode: String(randomInt(1000, 10000)),
          codeAttempts: 0,
          updatedAt: now.toISOString(),
          items,
          subtotalPaise: g.subtotalPaise,
          offerDiscountPaise: g.offerDiscountPaise,
          deliveryFeePaise: g.deliveryFeePaise,
          totalPaise: g.totalPaise,
          etaMin: g.store.etaMin,
        })
      }
      if (!catalog.reserve(everyAllocation, orderId, now)) {
        throw new AppError(409, 'CART_CHANGED', 'Your basket changed. Please review it.', svc.cart(input.lines, withDelivery))
      }

      const init = payments.initiate(input.paymentMethod, { orderId, amountPaise: validation.totalPaise, idempotencyKey: input.idempotencyKey })
      const prepaid = init.status === 'awaiting_payment'

      const record: OrderRecord = {
        id: orderId,
        ownerHash,
        idempotencyKey: input.idempotencyKey,
        fingerprint,
        status: 'awaiting_payment',
        createdAt: now.toISOString(),
        confirmedAt: null,
        cancelReason: null,
        reservationExpiresAt: prepaid ? new Date(now.getTime() + RESERVATION_MINUTES * 60_000).toISOString() : null,
        address: {
          name: input.address.name,
          phone: input.address.phone,
          line1: input.address.line1,
          area: area.name,
          town: town.name,
          pincode: input.address.pincode,
          instructions: input.address.instructions,
        },
        slot: input.slot,
        slotLabel: slotLabel(input.slot),
        storeOrders,
        subtotalPaise: validation.subtotalPaise,
        discountPaise: validation.discountPaise,
        deliveryPaise: validation.deliveryPaise,
        totalPaise: validation.totalPaise,
        payment: { method: input.paymentMethod, providerRef: init.providerRef, status: init.status, amountPaise: validation.totalPaise, attempts: prepaid ? 1 : 0 },
      }
      orders.insert(record)

      // Gate 3: cash on delivery has nothing to wait for, so it is confirmed right here — through the same final check
      // a prepaid order passes when its payment completes.
      if (!prepaid && !confirmRecord(record, now)) {
        throw new AppError(409, 'CART_CHANGED', 'Your basket changed. Please review it.', svc.cart(input.lines, withDelivery))
      }
      return view(record)
    },

    get(ownerToken, id) {
      expireReservations(clock())
      return view(owned(ownerToken, id))
    },

    list(ownerToken) {
      expireReservations(clock())
      return orders.listByOwner(hashToken(ownerToken)).map(view)
    },

    simulatePayment(ownerToken, id, outcome) {
      const now = clock()
      expireReservations(now)
      const o = owned(ownerToken, id)
      if (o.status !== 'awaiting_payment') throw new AppError(409, 'INVALID_STATE', 'This order is not waiting for payment')

      const result = payments.settleSimulated(o.payment.method, o.payment.providerRef, outcome)
      if (result === 'failed') {
        o.payment.attempts += 1
        o.payment.status = 'failed'
        if (o.payment.attempts > MAX_PAYMENT_ATTEMPTS) cancelRecord(o, 'too_many_failed_payments', now)
        return view(o)
      }

      // Gate 3 for prepaid orders: re-check the reserved stock at the moment of confirmation.
      if (!confirmRecord(o, now)) {
        throw new AppError(409, 'ORDER_CANCELLED_UNAVAILABLE', 'Some items became unavailable, so the order was cancelled and nothing was charged.', view(o))
      }
      o.payment.status = 'paid_simulated'
      return view(o)
    },

    listForStore(storeId) {
      expireReservations(clock())
      const out: OwnerStoreOrderView[] = []
      for (const o of orders.all()) {
        if (o.confirmedAt === null) continue // not a real order yet (unpaid, or timed out before confirming)
        for (const so of o.storeOrders) if (so.storeId === storeId) out.push(ownerView(o, so))
      }
      return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    },

    transition({ storeId, partnerId, storeOrderId, to, as, actor, reason, code }) {
      const now = clock()
      expireReservations(now)
      // Every actor is scoped: stores to their store, partners to their assignments. Only the platform sees all.
      if (as === 'store' && !storeId) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
      if (as === 'delivery' && !partnerId) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
      const found = findStoreOrder(storeOrderId, { storeId, partnerId })
      if (!found) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
      const { order, so } = found
      if (order.status !== 'confirmed') throw new AppError(409, 'INVALID_STATE', 'This order is not active.')
      if (!canTransition(so.status, to, as)) {
        throw new AppError(409, 'INVALID_TRANSITION', `An order that is "${so.status.replace('_', ' ')}" cannot move to "${to.replace('_', ' ')}".`)
      }
      const before = so.status
      if (to === 'rejected' || to === 'cancelled') {
        const r = (reason ?? '').replace(/\s+/g, ' ').trim()
        if (r.length < 5) throw new AppError(422, 'REASON_REQUIRED', 'Please give the customer a reason (at least 5 characters).')
        so.rejectReason = r.slice(0, 300)
        // This part is not being fulfilled, so its stock goes back on the shelf and any payment is (simulated) refunded.
        catalog.release(so.items.flatMap((i) => i.allocations), so.id, now)
        so.refundSimulatedPaise = order.payment.status === 'paid_simulated' ? so.totalPaise : 0
      }
      if (to === 'delivered') {
        // The partner must have the customer's code: proof the parcel reached the right person (simulated OTP).
        if (so.codeAttempts >= MAX_CODE_ATTEMPTS) throw new AppError(429, 'CODE_LOCKED', 'Too many wrong codes. Please contact support.')
        if ((code ?? '').trim() !== so.deliveryCode) {
          so.codeAttempts++
          throw new AppError(422, 'WRONG_CODE', `That code is not right. ${MAX_CODE_ATTEMPTS - so.codeAttempts} attempt(s) left.`)
        }
      }
      if (to === 'ready' && !so.partnerId && assignPartner) {
        const p = assignPartner(so.storeId)
        if (p) {
          so.partnerId = p.id
          so.partnerName = p.name
        }
      }
      so.status = to
      so.updatedAt = now.toISOString()
      so.history.push({ status: to, at: now.toISOString(), by: as })
      if (order.storeOrders.every((x) => x.status === 'rejected' || x.status === 'cancelled')) {
        order.status = 'cancelled'
        order.cancelReason = as === 'admin' ? 'cancelled_by_support' : as === 'system' ? 'items_unavailable' : 'rejected_by_store'
        order.payment.status = 'void'
      } else if (order.storeOrders.every((x) => isTerminal(x.status))) {
        order.status = 'completed'
      }
      audit.append(
        { actorId: actor.id, actorName: actor.name, actorRole: actor.role, storeId: so.storeId, action: `order.${to}`, entityType: 'store_order', entityId: so.id, summary: `Order ${so.id}: ${before.replace('_', ' ')} → ${to.replace('_', ' ')}`, reason: so.rejectReason, before: { status: before }, after: { status: to } },
        now,
      )
      return ownerView(order, so)
    },

    async listForPartner(partnerId) {
      expireReservations(clock())
      const all = await stores.listAll()
      const out: PartnerOrderView[] = []
      for (const o of orders.all()) {
        if (o.confirmedAt === null) continue
        for (const so of o.storeOrders) {
          if (so.partnerId !== partnerId) continue
          const st = all.find((x) => x.id === so.storeId)
          const town = demoTowns.find((t) => t.id === st?.townId)
          out.push({
            id: so.id,
            orderId: o.id,
            status: so.status,
            store: { name: so.storeName, area: town?.name ?? { en: '', ta: '' } },
            // The partner needs to reach the customer: full name, phone and address are a legitimate business need here.
            customer: { name: o.address.name, phone: o.address.phone, line1: o.address.line1, area: o.address.area, pincode: o.address.pincode, instructions: o.address.instructions },
            itemCount: so.items.reduce((n, i) => n + i.qty, 0),
            collectPaise: o.payment.method === 'cod' ? so.totalPaise : 0,
            paymentStatus: o.payment.status,
            etaMin: so.etaMin,
            updatedAt: so.updatedAt,
            nextSteps: nextSteps(so.status, 'delivery'),
          })
        }
      }
      return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    },

    listForAdmin() {
      expireReservations(clock())
      const out: AdminOrderRow[] = []
      for (const o of orders.all()) {
        if (o.confirmedAt === null) continue
        for (const so of o.storeOrders) {
          out.push({
            storeOrderId: so.id,
            orderId: o.id,
            storeId: so.storeId,
            storeName: so.storeName,
            status: so.status,
            createdAt: o.confirmedAt,
            totalPaise: so.totalPaise,
            paymentLabel: payments.info(o.payment.method).label,
            paymentStatus: o.payment.status,
            customerName: o.address.name,
            customerPhoneMasked: `••••••${o.address.phone.slice(-4)}`,
            area: o.address.area,
            rejectReason: so.rejectReason,
            nextSteps: nextSteps(so.status, 'admin'),
          })
        }
      }
      return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    },

    cancel(ownerToken, id) {
      const now = clock()
      expireReservations(now)
      const o = owned(ownerToken, id)
      if (o.status !== 'awaiting_payment') throw new AppError(409, 'INVALID_STATE', 'Only an order waiting for payment can be cancelled here')
      cancelRecord(o, 'cancelled_by_customer', now)
      return view(o)
    },
  }
}
