import type { Request, RequestHandler } from 'express'
import { AppError } from './errors.js'

interface Options {
  windowMs: number
  max: number
  /** Defaults to the guest token when present, else the client IP. */
  key?: (req: Request) => string
  now?: () => number
}

/** Fixed-window limiter, in memory. Fine for one process; a shared store (Redis) is needed behind several. */
export function rateLimit({ windowMs, max, key, now = Date.now }: Options): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return (req, res, next) => {
    const t = now()
    const k = key?.(req) ?? req.header('x-guest-token') ?? req.ip ?? 'unknown'
    let h = hits.get(k)
    if (!h || h.resetAt <= t) {
      h = { count: 0, resetAt: t + windowMs }
      hits.set(k, h)
    }
    h.count++
    // Opportunistic cleanup so the map cannot grow without bound.
    if (hits.size > 5000) for (const [kk, v] of hits) if (v.resetAt <= t) hits.delete(kk)
    if (h.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((h.resetAt - t) / 1000))))
      throw new AppError(429, 'TOO_MANY_REQUESTS', 'Too many requests. Please wait a moment and try again.')
    }
    next()
  }
}
