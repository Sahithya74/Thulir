import type { OrderRecord } from './order.types.js'

/** Persistence boundary for orders. A MySQL implementation arrives with the owner phase. */
export interface OrderRepository {
  insert(order: OrderRecord): void
  byId(id: string): OrderRecord | undefined
  findByKey(ownerHash: string, idempotencyKey: string): OrderRecord | undefined
  listByOwner(ownerHash: string): OrderRecord[]
  awaitingPayment(): OrderRecord[]
  all(): OrderRecord[]
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, OrderRecord>()

  insert(order: OrderRecord) {
    this.orders.set(order.id, order)
  }
  byId(id: string) {
    return this.orders.get(id)
  }
  findByKey(ownerHash: string, idempotencyKey: string) {
    for (const o of this.orders.values()) if (o.ownerHash === ownerHash && o.idempotencyKey === idempotencyKey) return o
    return undefined
  }
  listByOwner(ownerHash: string) {
    return [...this.orders.values()].filter((o) => o.ownerHash === ownerHash).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }
  awaitingPayment() {
    return [...this.orders.values()].filter((o) => o.status === 'awaiting_payment')
  }
  all() {
    return [...this.orders.values()]
  }
}
