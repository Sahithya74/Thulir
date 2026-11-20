import type { RequestHandler } from 'express'
import { AppError } from './errors.js'

/**
 * Phase 4 has no accounts yet (they arrive with the owner/admin phase), so a customer is an anonymous browser holding
 * a random secret token. Orders are tied to that token: only the holder can read or act on them, and the server keeps
 * just a hash of it. This is capability-style guest checkout — NOT authentication — and the UI says orders are tied to
 * this browser.
 */
const TOKEN = /^[A-Za-z0-9_-]{24,64}$/

declare module 'express-serve-static-core' {
  interface Locals {
    guestToken?: string
  }
}

export const requireGuestToken: RequestHandler = (req, res, next) => {
  const t = req.header('x-guest-token')
  if (!t || !TOKEN.test(t)) throw new AppError(401, 'GUEST_TOKEN_REQUIRED', 'A valid guest token is required')
  res.locals.guestToken = t
  next()
}
