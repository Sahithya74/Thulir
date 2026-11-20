import type { StoreOrderStatus } from './types.ts'

/**
 * The only definition of how a store order may move. Every route that changes an order status goes through
 * `assertTransition`; nothing writes a status directly. Each step names who is allowed to take it.
 */
export type Actor = 'customer' | 'store' | 'delivery' | 'admin' | 'system'

interface Step {
  to: StoreOrderStatus
  by: Actor[]
}

export const STORE_ORDER_TRANSITIONS: Record<StoreOrderStatus, Step[]> = {
  placed: [
    { to: 'accepted', by: ['store'] },
    { to: 'rejected', by: ['store'] },
    { to: 'cancelled', by: ['system', 'admin'] },
  ],
  accepted: [
    { to: 'preparing', by: ['store'] },
    { to: 'cancelled', by: ['system', 'admin'] },
  ],
  preparing: [
    { to: 'ready', by: ['store'] },
    { to: 'cancelled', by: ['system', 'admin'] },
  ],
  ready: [
    { to: 'handed_over', by: ['store'] },
    { to: 'cancelled', by: ['system', 'admin'] },
  ],
  handed_over: [{ to: 'out_for_delivery', by: ['delivery'] }],
  out_for_delivery: [{ to: 'delivered', by: ['delivery'] }],
  delivered: [],
  rejected: [],
  cancelled: [],
}

export const TERMINAL: StoreOrderStatus[] = ['delivered', 'rejected', 'cancelled']

export const isTerminal = (s: StoreOrderStatus) => TERMINAL.includes(s)

export function canTransition(from: StoreOrderStatus, to: StoreOrderStatus, actor: Actor): boolean {
  return STORE_ORDER_TRANSITIONS[from].some((s) => s.to === to && s.by.includes(actor))
}

/** The steps a given actor may take next from a status (drives which buttons a portal shows). */
export function nextSteps(from: StoreOrderStatus, actor: Actor): StoreOrderStatus[] {
  return STORE_ORDER_TRANSITIONS[from].filter((s) => s.by.includes(actor)).map((s) => s.to)
}

/** Stages a customer sees, in order (rejected / cancelled branch off it). */
export const CUSTOMER_STAGES: StoreOrderStatus[] = ['placed', 'accepted', 'preparing', 'ready', 'handed_over', 'out_for_delivery', 'delivered']
