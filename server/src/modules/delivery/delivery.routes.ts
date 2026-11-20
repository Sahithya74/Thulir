import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../../middleware/errors.js'
import { authenticate, requireCsrf, requireRole } from '../../middleware/auth.js'
import type { AuthService } from '../auth/auth.service.js'
import type { OrderService } from '../orders/order.service.js'

const body = z
  .object({
    to: z.enum(['out_for_delivery', 'delivered', 'placed', 'accepted', 'preparing', 'ready', 'handed_over', 'rejected', 'cancelled']),
    code: z.string().max(8).optional(),
  })
  .strict()

/**
 * Delivery partner API. A partner sees and moves only orders assigned to them, and only along the road steps the
 * shared state machine gives to "delivery". Marking delivered needs the customer's handover code.
 */
export function deliveryRoutes(auth: AuthService, orders: OrderService): Router {
  const r = Router()
  r.use(authenticate(auth), requireRole('delivery_partner'), requireCsrf)

  r.get('/orders', async (_req, res) => {
    res.json({ data: await orders.listForPartner(res.locals.user!.id) })
  })

  r.post('/orders/:soid/transition', async (req, res) => {
    const u = res.locals.user!
    const soid = z.string().max(40).parse(req.params.soid)
    const b = body.parse(req.body)
    orders.transition({ partnerId: u.id, storeOrderId: soid, to: b.to, as: 'delivery', actor: { id: u.id, name: u.name, role: u.role }, code: b.code })
    const view = (await orders.listForPartner(u.id)).find((o) => o.id === soid)
    if (!view) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found')
    res.json({ data: view })
  })

  return r
}
