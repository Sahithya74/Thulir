import type { PaymentMethodId, PaymentMethodInfo } from '@thulir/shared'
import { AppError } from '../../middleware/errors.js'
import { CashOnDeliveryProvider, simulatedOnline, simulatedUpi, type PaymentInit, type PaymentProvider, type SettleOutcome } from './providers.js'

export interface PaymentService {
  methods(): PaymentMethodInfo[]
  info(id: PaymentMethodId): PaymentMethodInfo
  initiate(id: PaymentMethodId, input: { orderId: string; amountPaise: number; idempotencyKey: string }): PaymentInit
  /** Settle a SIMULATED payment. Throws for any provider that is not simulated. */
  settleSimulated(id: PaymentMethodId, providerRef: string, outcome: SettleOutcome): 'paid_simulated' | 'failed'
}

/** The registry the rest of the server talks to. Swapping in a real gateway changes this file, not the order logic. */
export function createPaymentService(providers: PaymentProvider[] = [new CashOnDeliveryProvider(), simulatedUpi(), simulatedOnline()]): PaymentService {
  const byId = new Map(providers.map((p) => [p.info.id, p]))
  const get = (id: PaymentMethodId) => {
    const p = byId.get(id)
    if (!p) throw new AppError(400, 'PAYMENT_METHOD_UNKNOWN', 'Unknown payment method')
    return p
  }
  return {
    methods: () => providers.map((p) => p.info),
    info: (id) => get(id).info,
    initiate: (id, input) => get(id).initiate(input),
    settleSimulated(id, providerRef, outcome) {
      const p = get(id)
      if (!p.info.simulated || !p.settleSimulated) {
        throw new AppError(400, 'PAYMENT_NOT_SIMULATED', 'This payment method cannot be settled here')
      }
      return p.settleSimulated(providerRef, outcome)
    },
  }
}
