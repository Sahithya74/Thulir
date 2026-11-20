import { Router } from 'express'
import { z } from 'zod'
import { checkPincode, demoTowns } from '@thulir/shared'
import { AppError } from '../../middleware/errors.js'

const pincodeQuery = z.object({
  townId: z.string().min(1).max(64),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
})

export function locationRoutes(): Router {
  const r = Router()

  /** Towns with their areas. Data-driven so more towns can be added without code changes. */
  r.get('/', (_req, res) => {
    res.json({ data: demoTowns })
  })

  /** Server-side pincode serviceability — the client never decides this on its own. */
  r.get('/pincode', (req, res) => {
    const { townId, pincode } = pincodeQuery.parse(req.query)
    const town = demoTowns.find((t) => t.id === townId)
    if (!town) throw new AppError(404, 'TOWN_NOT_FOUND', 'Town not found')
    res.json({ data: { townId, pincode, result: checkPincode(town, pincode) } })
  })

  return r
}
