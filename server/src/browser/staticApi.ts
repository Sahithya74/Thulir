import { installBuffer, BrowserBuffer } from './buffer.js'
import type { ShimRequest, ShimResponse, ShimRouter } from './express.js'

/**
 * STATIC DEMO MODE (GitHub Pages). Pages can only serve files, so this runs the real Thulir API — the same route
 * modules, validation, freshness engine, order state machine and role checks as the Node server — inside the
 * visitor's browser tab, behind a fetch() bridge for /api/v1. Data lives in memory and resets on reload.
 * Nothing here is sent anywhere.
 */
installBuffer()

const SESSION_JAR = new Map<string, string>()

function readDocumentCookies(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of document.cookie.split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

/** Uploaded photos become blob: URLs that live as long as the tab. */
class BlobImageStorage {
  private readonly urls = new Set<string>()
  async save(buf: Uint8Array, ext: string) {
    const url = URL.createObjectURL(new Blob([buf as Uint8Array<ArrayBuffer>], { type: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` }))
    this.urls.add(url)
    return url
  }
  async remove(url: string) {
    if (this.urls.delete(url)) URL.revokeObjectURL(url)
  }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

export async function installStaticApi(): Promise<void> {
  // Imported after the Buffer shim is in place.
  const [{ createApi }, { errorHandler }] = await Promise.all([import('../api.js'), import('../middleware/errors.js')])
  const secret = BrowserBuffer.make(Array.from(crypto.getRandomValues(new Uint8Array(32)))).toString('hex')
  const api = createApi({
    clock: () => new Date(),
    jwtSecret: secret,
    // Lower than the server's 12: bcrypt runs on the main thread here. Accounts are published demo accounts anyway.
    bcryptCost: 6,
    secureCookies: false,
    images: new BlobImageStorage() as never,
    seedDemo: true,
    runtime: 'browser (static demo)',
    rateLimits: { orderCreatePerMinute: 30, cartValidatePerMinute: 600, loginPerMinute: 20 },
  })
  const router = api.router as unknown as ShimRouter
  window.setInterval(() => void api.sweep(), 10 * 60_000)

  const realFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/v1/')) return realFetch(input, init)
    await api.ready

    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v))
    let body: unknown = undefined
    const raw = init?.body
    if (raw instanceof Blob) body = BrowserBuffer.make(await raw.arrayBuffer())
    else if (typeof raw === 'string' && raw.length) {
      try {
        body = JSON.parse(raw)
      } catch {
        return json(400, { error: { code: 'BAD_REQUEST', message: 'The request body could not be read.' } })
      }
    }
    const query: Record<string, string | string[]> = {}
    url.searchParams.forEach((v, k) => {
      const cur = query[k]
      query[k] = cur === undefined ? v : Array.isArray(cur) ? [...cur, v] : [cur, v]
    })
    const path = url.pathname.slice('/api/v1'.length) || '/'
    const req: ShimRequest = {
      method,
      path,
      url: path + url.search,
      query,
      params: {},
      body,
      headers,
      cookies: { ...readDocumentCookies(), ...Object.fromEntries(SESSION_JAR) },
      ip: 'browser',
      header: (n) => headers[n.toLowerCase()],
      get: (n) => headers[n.toLowerCase()],
    }
    const res: ShimResponse = {
      statusCode: 200,
      locals: {},
      headers: {},
      body: undefined,
      finished: false,
      status(c) {
        res.statusCode = c
        return res
      },
      json(b) {
        res.body = b
        res.finished = true
        return res
      },
      setHeader(n, v) {
        res.headers[n] = v
        return res
      },
      cookie(name, value, o = {}) {
        if (o.httpOnly) SESSION_JAR.set(name, value) // kept out of document.cookie, like an httpOnly cookie
        else document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`
        return res
      },
      clearCookie(name, o = {}) {
        if (o.httpOnly) SESSION_JAR.delete(name)
        else document.cookie = `${name}=; path=/; max-age=0`
        return res
      },
    }

    try {
      const handled = await router.__handle(req, res, path.split('/').filter(Boolean), {})
      if (!handled) res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
    } catch (err) {
      ;(errorHandler as unknown as (e: unknown, q: ShimRequest, r: ShimResponse, n: () => void) => void)(err, req, res, () => undefined)
    }
    return json(res.statusCode, res.body, res.headers)
  }
}
