import { BrowserBuffer } from './buffer.js'
import { createHash } from './crypto.js'

/**
 * Browser stand-in for `jsonwebtoken` (HS256 only), used by the in-browser demo. The token never leaves the tab, so
 * this is about keeping the server code unchanged, not about real security. Signature = SHA-256(secret + "." + body).
 */
const b64 = (s: string) => BrowserBuffer.make(s).toString('base64url')
const unb64 = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/')
  return new TextDecoder().decode(Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0)))
}
const sig = (secret: string, body: string) => createHash('sha256').update(`${secret}.${body}`).digest('base64url') as string

function hours(expiresIn: string | number | undefined): number | undefined {
  if (expiresIn === undefined) return undefined
  if (typeof expiresIn === 'number') return expiresIn
  const m = /^(\d+)([smhd])$/.exec(expiresIn)
  if (!m) return undefined
  return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd']
}

export function sign(payload: Record<string, unknown>, secret: string, opts: { expiresIn?: string | number } = {}): string {
  const now = Math.floor(Date.now() / 1000)
  const ttl = hours(opts.expiresIn)
  const body = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ ...payload, iat: now, ...(ttl ? { exp: now + ttl } : {}) }))}`
  return `${body}.${sig(secret, body)}`
}

export function verify(token: string, secret: string): Record<string, unknown> {
  const parts = String(token).split('.')
  if (parts.length !== 3) throw new Error('jwt malformed')
  const body = `${parts[0]}.${parts[1]}`
  if (sig(secret, body) !== parts[2]) throw new Error('invalid signature')
  const head = JSON.parse(unb64(parts[0]!)) as { alg?: string }
  if (head.alg !== 'HS256') throw new Error('invalid algorithm')
  const p = JSON.parse(unb64(parts[1]!)) as Record<string, unknown>
  if (typeof p.exp === 'number' && p.exp < Date.now() / 1000) throw new Error('jwt expired')
  return p
}

export default { sign, verify }
