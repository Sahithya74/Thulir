import { randomBytes } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

export type ImageExt = 'png' | 'jpg' | 'webp'
export const IMAGE_MIME: Record<ImageExt, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }
export const MAX_IMAGE_BYTES = 1024 * 1024

/**
 * Identify an image by its first bytes, not by what the client says it is. Only PNG, JPEG and WebP are accepted.
 * SVG is deliberately refused: an SVG can carry script.
 */
export function sniffImage(buf: Buffer): ImageExt | null {
  if (buf.length < 12) return null
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  return null
}

/** Where uploaded images live. Swap the implementation (object storage, CDN) without touching the routes. */
export interface ImageStorage {
  /** Stores the bytes and returns the public URL path. */
  save(buf: Buffer, ext: ImageExt): Promise<string>
  /** Best-effort delete of a previously returned URL. Ignores anything that is not one of our own files. */
  remove(url: string): Promise<void>
}

const OWN_URL = /^\/uploads\/[a-f0-9]{24}\.(png|jpg|webp)$/

export class LocalDiskStorage implements ImageStorage {
  private readonly dir: string
  constructor(dir: string) {
    this.dir = resolve(dir)
  }

  async save(buf: Buffer, ext: ImageExt): Promise<string> {
    await mkdir(this.dir, { recursive: true })
    const name = `${randomBytes(12).toString('hex')}.${ext}` // a random name: the client never chooses a path
    await writeFile(join(this.dir, name), buf, { flag: 'wx' })
    return `/uploads/${name}`
  }

  async remove(url: string): Promise<void> {
    if (!OWN_URL.test(url)) return
    const file = resolve(this.dir, url.slice('/uploads/'.length))
    if (!file.startsWith(this.dir + sep)) return
    await unlink(file).catch(() => undefined)
  }
}

/** In-memory storage for tests: no disk, same contract. */
export class MemoryStorage implements ImageStorage {
  readonly files = new Map<string, Buffer>()
  async save(buf: Buffer, ext: ImageExt) {
    const url = `/uploads/${randomBytes(12).toString('hex')}.${ext}`
    this.files.set(url, buf)
    return url
  }
  async remove(url: string) {
    this.files.delete(url)
  }
}
