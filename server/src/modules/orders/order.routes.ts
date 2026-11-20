import { Router } from 'express'
import { z } from 'zod'
import { normaliseIndianMobile } from '@thulir/shared'
import { requireGuestToken } from '../../middleware/guestToken.js'
import { rateLimit } from '../../middleware/rateLimit.js'
import type { OrderService } from './order.service.js'

const stripControl = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
const text = (min: number, max: number) => z.string().transform(stripControl).pipe(z.string().min(min).max(max))

const line = z.object({ productId: z.string().min(1).max(64), qty: z.number() }).strict()

const mobile = z
  .string()
  .max(24)
  .transform((s, ctx) => {
    const n = normaliseIndianMobile(s)
    if (!n) ctx.addIssue({ code: 'custom', message: 'Enter a valid 10-digit Indian mobile number' })
    return n ?? ''
  })

const createOrder = z
  .object({
    lines: z.array(line).min(1).max(60),
    address: z
      .object({
        name: text(2, 60),
        phone: mobile,
        line1: text(3, 80),
        areaId: z.string().min(1).max(64),
        pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
        instructions: text(0, 200).default(''),
      })
      .strict(),
    slot: z.union([
      z.object({ kind: z.literal('asap') }).strict(),
      z.object({ kind: z.literal('window'), startHour: z.number().int().min(0).max(23) }).strict(),
    ]),
    paymentMethod: z.enum(['cod', 'upi_sim', 'online_sim']),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, 'Invalid request key'),
  })
  .strict()

const outcome = z.object({ outcome: z.enum(['success', 'failure']) }).strict()
const orderId = z.object({ id: z.string().regex(/^TH-[0-9A-F]{8}$/) })

export interface OrderRouteLimits {
  createPerMinute: number
}

export function orderRoutes(service: OrderService, limits: OrderRouteLimits): Router {
  const r = Router()
  r.use(requireGuestToken)
  const token = (res: { locals: { guestToken?: string } }) => res.locals.guestToken as string

  r.post('/', rateLimit({ windowMs: 60_000, max: limits.createPerMinute }), async (req, res) => {
    const input = createOrder.parse(req.body)
    const order = await service.create(token(res), input)
    res.status(201).json({ data: order })
  })

  r.get('/', (_req, res) => {
    res.json({ data: service.list(token(res)) })
  })

  r.get('/:id', (req, res) => {
    res.json({ data: service.get(token(res), orderId.parse(req.params).id) })
  })

  r.post('/:id/payment/simulate', (req, res) => {
    const { outcome: o } = outcome.parse(req.body)
    res.json({ data: service.simulatePayment(token(res), orderId.parse(req.params).id, o) })
  })

  r.post('/:id/cancel', (req, res) => {
    res.json({ data: service.cancel(token(res), orderId.parse(req.params).id) })
  })

  return r
}
