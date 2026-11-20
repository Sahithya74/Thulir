import type { StoreOrderStatus } from '@thulir/shared'
import type { OrderService } from './modules/orders/order.service.js'

/** A token no real browser holds: these demo orders belong to no customer's "My orders". */
const SEED_TOKEN = 'demo-seed-token-0123456789abcdef'

interface SeedOrder {
  who: string
  lines: { productId: string; qty: number }[]
  /** Steps the store takes, in order. */
  steps: StoreOrderStatus[]
  reject?: string
}

const SCRIPT: SeedOrder[] = [
  { who: 'Meena Raj', lines: [{ productId: 'sv-03', qty: 2 }, { productId: 'sv-04', qty: 1 }], steps: [] },
  { who: 'Karthik Subramani', lines: [{ productId: 'sv-01', qty: 5 }], steps: ['accepted'] },
  { who: 'Lakshmi Narayanan', lines: [{ productId: 'sv-06', qty: 1 }, { productId: 'sv-09', qty: 1 }], steps: ['accepted', 'preparing'] },
  { who: 'Ravi Chandran', lines: [{ productId: 'mb-01', qty: 2 }, { productId: 'mb-03', qty: 1 }], steps: [] },
  { who: 'Deepa Anand', lines: [{ productId: 'mb-04', qty: 1 }], steps: ['accepted', 'preparing', 'ready'] },
  { who: 'Suresh Babu', lines: [{ productId: 'mm-01', qty: 1 }, { productId: 'mm-02', qty: 1 }], steps: ['accepted', 'preparing', 'ready', 'handed_over'] },
  { who: 'Priya Venkat', lines: [{ productId: 'td-01', qty: 4 }, { productId: 'td-08', qty: 1 }], steps: [] },
  { who: 'Arun Kumar', lines: [{ productId: 'ih-09', qty: 1 }], steps: ['rejected'], reject: 'Sorry, we are out of that pack today.' },
]

/**
 * Create a few demo orders through the real order service (so stock, pricing and validation are genuine), then walk
 * some of them forward as the store. Failures are logged and skipped: seeding must never stop the server starting.
 */
export async function seedDemoOrders(orders: OrderService, stores: Record<string, string[]>): Promise<number> {
  let made = 0
  let i = 0
  for (const s of SCRIPT) {
    i++
    try {
      const o = await orders.create(SEED_TOKEN, {
        lines: s.lines,
        address: { name: s.who, phone: '9876500000', line1: `${10 + i}, Demo Street`, areaId: 'area-a-market', pincode: '600991', instructions: '' },
        slot: { kind: 'asap' },
        paymentMethod: 'cod',
        idempotencyKey: `seed-order-${i}-aaaaaaaaaaaa`,
      })
      for (const so of o.storeOrders) {
        for (const step of s.steps) {
          orders.transition({ storeId: so.store.id, storeOrderId: so.id, to: step, as: 'store', actor: { id: 'seed', name: 'Demo seed', role: 'system' }, reason: s.reject })
        }
      }
      made++
    } catch (e) {
      console.warn(`seed order ${i} skipped:`, (e as Error).message)
    }
  }
  void stores
  return made
}
