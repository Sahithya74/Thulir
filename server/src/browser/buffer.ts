/**
 * The small part of Node's Buffer that the server modules use, for the in-browser demo build. Installed as
 * `globalThis.Buffer` before any server module runs.
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export class BrowserBuffer extends Uint8Array {
  static make(src: string | ArrayLike<number> | ArrayBuffer, enc: string = 'utf8'): BrowserBuffer {
    if (typeof src === 'string') {
      if (enc === 'hex') return new BrowserBuffer((src.match(/../g) ?? []).map((h) => parseInt(h, 16)))
      if (enc === 'latin1' || enc === 'binary') return new BrowserBuffer([...src].map((c) => c.charCodeAt(0) & 0xff))
      return new BrowserBuffer(new TextEncoder().encode(src))
    }
    if (src instanceof ArrayBuffer) return new BrowserBuffer(new Uint8Array(src))
    return new BrowserBuffer(Array.from(src))
  }

  static isBuffer(x: unknown): x is BrowserBuffer {
    return x instanceof BrowserBuffer
  }

  equals(other: Uint8Array): boolean {
    return this.length === other.length && this.every((v, i) => v === other[i])
  }

  override toString(enc: string = 'utf8'): string {
    if (enc === 'hex') return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('')
    if (enc === 'latin1' || enc === 'binary') return String.fromCharCode(...this)
    if (enc === 'base64' || enc === 'base64url') {
      let out = ''
      for (let i = 0; i < this.length; i += 3) {
        const n = (this[i]! << 16) | ((this[i + 1] ?? 0) << 8) | (this[i + 2] ?? 0)
        out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < this.length ? B64[(n >> 6) & 63]! : '=') + (i + 2 < this.length ? B64[n & 63]! : '=')
      }
      return enc === 'base64' ? out : out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }
    return new TextDecoder().decode(this)
  }
}

export function installBuffer() {
  const g = globalThis as unknown as { Buffer?: unknown }
  // Node's Buffer.from takes an encoding; Uint8Array.from does not, so attach ours at runtime under that name.
  Object.defineProperty(BrowserBuffer, 'from', { value: BrowserBuffer.make, configurable: true })
  if (!g.Buffer) g.Buffer = BrowserBuffer
}
