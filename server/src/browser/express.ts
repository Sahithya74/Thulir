/**
 * A tiny Express-compatible router for the in-browser demo. It implements exactly what the route modules use:
 * Router({ mergeParams }), .use(path?, ...handlers), .get/.post/.put/.patch/.delete, ":param" segments, async
 * handlers, and next(err). Requests come from a fetch() bridge (staticApi.ts), not from a network socket.
 */
export interface ShimRequest {
  method: string
  path: string
  url: string
  query: Record<string, string | string[]>
  params: Record<string, string>
  body: unknown
  headers: Record<string, string>
  cookies: Record<string, string>
  ip: string
  header(name: string): string | undefined
  get(name: string): string | undefined
}

export interface ShimResponse {
  statusCode: number
  locals: Record<string, unknown>
  headers: Record<string, string>
  body: unknown
  finished: boolean
  status(code: number): ShimResponse
  json(body: unknown): ShimResponse
  setHeader(name: string, value: string): ShimResponse
  cookie(name: string, value: string, opts?: { httpOnly?: boolean }): ShimResponse
  clearCookie(name: string, opts?: { httpOnly?: boolean }): ShimResponse
}

type Next = (err?: unknown) => void
type Handler = (req: ShimRequest, res: ShimResponse, next: Next) => unknown

interface Layer {
  method: string | null
  pattern: string[]
  handlers: (Handler | ShimRouter)[]
}

export interface ShimRouter {
  (req: ShimRequest, res: ShimResponse, next: Next): void
  __handle(req: ShimRequest, res: ShimResponse, segs: string[], params: Record<string, string>): Promise<boolean>
  use(...args: unknown[]): ShimRouter
  get(path: string, ...h: Handler[]): ShimRouter
  post(path: string, ...h: Handler[]): ShimRouter
  put(path: string, ...h: Handler[]): ShimRouter
  patch(path: string, ...h: Handler[]): ShimRouter
  delete(path: string, ...h: Handler[]): ShimRouter
}

const segments = (p: string) => p.split('/').filter(Boolean)
const isRouter = (h: unknown): h is ShimRouter => typeof h === 'function' && '__handle' in h

function match(pattern: string[], segs: string[], prefix: boolean): Record<string, string> | null {
  if (prefix ? segs.length < pattern.length : segs.length !== pattern.length) return null
  const out: Record<string, string> = {}
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i]!
    if (p.startsWith(':')) out[p.slice(1)] = decodeURIComponent(segs[i]!)
    else if (p !== segs[i]) return null
  }
  return out
}

/** Run one handler. Resolves true if it called next(), false if it answered; rejects on error. */
function step(h: Handler, req: ShimRequest, res: ShimResponse): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const next: Next = (err) => (err ? reject(err) : resolve(true))
    try {
      const r = h(req, res, next) as Promise<unknown> | undefined
      if (r && typeof r.then === 'function') r.then(() => res.finished && resolve(false), reject)
      else if (res.finished) resolve(false)
    } catch (e) {
      reject(e)
    }
  })
}

export function Router(opts: { mergeParams?: boolean } = {}): ShimRouter {
  const layers: Layer[] = []
  const router = ((_req: ShimRequest, _res: ShimResponse, next: Next) => next()) as ShimRouter

  router.__handle = async (req, res, segs, parent) => {
    for (const l of layers) {
      if (l.method && l.method !== req.method) continue
      const m = match(l.pattern, segs, l.method === null)
      if (!m) continue
      const params = { ...(opts.mergeParams ? parent : {}), ...m }
      for (const h of l.handlers) {
        req.params = params
        if (isRouter(h)) {
          if (await h.__handle(req, res, segs.slice(l.pattern.length), params)) return true
        } else if (!(await step(h, req, res))) return true
      }
    }
    return false
  }

  router.use = (...args: unknown[]) => {
    const path = typeof args[0] === 'string' ? (args.shift() as string) : '/'
    layers.push({ method: null, pattern: segments(path), handlers: args as Handler[] })
    return router
  }
  for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
    router[method] = (path: string, ...h: Handler[]) => {
      layers.push({ method: method.toUpperCase(), pattern: segments(path), handlers: h })
      return router
    }
  }
  return router
}

const passThrough = (): Handler => (_req, _res, next) => next()

/** Only what route modules reach for on the default export. Bodies are already parsed by the bridge. */
const express = { Router, raw: passThrough, json: passThrough, static: passThrough }
export default express
