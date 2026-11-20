import type { PaymentMethodId, PaymentMethodInfo } from '@thulir/shared'
import { AppError } from '../../middleware/errors.js'

export type SettleOutcome = 'success' | 'failure'

export interface PaymentInit {
  /** cod_pending: nothing to collect online. awaiting_payment: the customer must complete a payment step. */
  status: 'cod_pending' | 'awaiting_payment'
  providerRef: string
}

export interface PaymentProvider {
  readonly info: PaymentMethodInfo
  initiate(input: { orderId: string; amountPaise: number; idempotencyKey: string }): PaymentInit
  /** Only simulated providers can be settled by the customer pressing a demo button. Real gateways settle via webhook. */
  settleSimulated?(providerRef: string, outcome: SettleOutcome): 'paid_simulated' | 'failed'
}

export class CashOnDeliveryProvider implements PaymentProvider {
  readonly info: PaymentMethodInfo = {
    id: 'cod',
    label: 'Cash on delivery',
    simulated: false,
    description: 'Pay in cash when the order arrives. In this demo no real order is placed or delivered.',
  }
  initiate({ orderId }: { orderId: string }): PaymentInit {
    return { status: 'cod_pending', providerRef: `cod_${orderId}` }
  }
}

class SimulatedProvider implements PaymentProvider {
  readonly info: PaymentMethodInfo
  constructor(id: PaymentMethodId, label: string, description: string) {
    this.info = { id, label, simulated: true, description }
  }
  initiate({ orderId, idempotencyKey }: { orderId: string; idempotencyKey: string }): PaymentInit {
    return { status: 'awaiting_payment', providerRef: `sim_${orderId}_${idempotencyKey.slice(0, 8)}` }
  }
  settleSimulated(_ref: string, outcome: SettleOutcome) {
    return outcome === 'success' ? ('paid_simulated' as const) : ('failed' as const)
  }
}

/** UPI, simulated: no UPI ID is collected and no money moves. */
export const simulatedUpi = () =>
  new SimulatedProvider('upi_sim', 'UPI (simulation)', 'A demo of UPI payment. No UPI ID is collected and no money moves.')

/** Online payment, simulated: no card or bank details are collected and no money moves. */
export const simulatedOnline = () =>
  new SimulatedProvider('online_sim', 'Online payment (simulation)', 'A demo of paying online. No card or bank details are collected and no money moves.')

/**
 * Where a real gateway (e.g. Razorpay) plugs in. It is deliberately NOT usable yet:
 *  - It would create the gateway order on the server, using secrets read only from server environment variables.
 *  - The browser would receive only a public key id and an order id — never a secret.
 *  - Payment success would be confirmed by a signed webhook verified on the server, never by the browser's say-so.
 * Until that is built and reviewed, calling it fails loudly rather than pretending to take money.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly info: PaymentMethodInfo = {
    id: 'online_sim',
    label: 'Online payment',
    simulated: false,
    description: 'Not connected.',
  }
  initiate(): PaymentInit {
    throw new AppError(501, 'PAYMENT_PROVIDER_NOT_CONFIGURED', 'No real payment provider is connected to this prototype')
  }
}
