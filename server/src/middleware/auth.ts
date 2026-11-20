import { timingSafeEqual } from 'node:crypto'
import type { Request, RequestHandler } from 'express'
import type { SessionUser, UserRole } from '@thulir/shared'
import { AppError } from './errors.js'
import { CSRF_COOKIE, SESSION_COOKIE, toSessionUser, type AuthService } from '../modules/auth/auth.service.js'

declare module 'express-serve-static-core' {
  interface Locals {
    user?: SessionUser
  }
}

/** Reads the session cookie and attaches the signed-in user (fresh from the repository). 401 if there is none. */
export const authenticate =
  (auth: AuthService): RequestHandler =>
  (req, res, next) => {
    const user = auth.verify((req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE])
    if (!user) throw new AppError(401, 'NOT_SIGNED_IN', 'Please sign in.')
    res.locals.user = toSessionUser(user)
    next()
  }

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (_req, res, next) => {
    const u = res.locals.user
    if (!u || !roles.includes(u.role)) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this.')
    next()
  }

/**
 * An owner may only touch stores they own. Unknown and foreign store ids get the same 403, so a store id cannot be
 * probed for existence.
 */
export const requireStoreAccess =
  (param = 'storeId'): RequestHandler =>
  (req, res, next) => {
    const u = res.locals.user
    const id = (req.params as Record<string, string>)[param]
    if (!u || u.role !== 'store_owner' || !u.storeIds.includes(id)) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this store.')
    next()
  }

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

function same(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Double-submit CSRF protection for cookie-authenticated, state-changing requests: the readable CSRF cookie must be
 * echoed in a header. A page on another origin can make the browser send our cookies but cannot read this one.
 */
export const requireCsrf: RequestHandler = (req: Request, _res, next) => {
  if (SAFE.has(req.method)) return next()
  const cookie = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE]
  const header = req.header('x-csrf-token')
  if (!cookie || !header || !same(cookie, header)) throw new AppError(403, 'CSRF_FAILED', 'Security check failed. Please reload and try again.')
  next()
}
