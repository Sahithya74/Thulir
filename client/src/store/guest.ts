const KEY = 'thulir.guestToken'
let memory: string | null = null

function make(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Anonymous customer identity for this browser (accounts arrive in a later phase). Orders are tied to this token; the
 * server stores only a hash of it. Clearing site data loses access to past orders — the UI says so.
 */
export function getGuestToken(): string {
  try {
    const t = localStorage.getItem(KEY)
    if (t && /^[A-Za-z0-9_-]{24,64}$/.test(t)) return t
    const fresh = make()
    localStorage.setItem(KEY, fresh)
    return fresh
  } catch {
    return (memory ??= make())
  }
}

/** A fresh key per checkout attempt; retried requests reuse it so the server can de-duplicate them. */
export function newIdempotencyKey(): string {
  return make() + make().slice(0, 8)
}
