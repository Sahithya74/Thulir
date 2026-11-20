import { CanvasTexture, SRGBColorSpace } from 'three'
import type { ProductView } from '@thulir/shared'

const cache = new Map<string, CanvasTexture>()

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

/**
 * Label artwork for a 3D pack, drawn on a small canvas: brand initial, product name, size. Cached per product and
 * disposed in bulk when the shelf scene unmounts (see disposePackTextures).
 */
export function packTexture(p: ProductView): CanvasTexture {
  const hit = cache.get(p.id)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 192
  c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = '#f5f2ea'
  g.fillRect(0, 0, 192, 160)
  g.fillStyle = p.color
  g.fillRect(0, 0, 192, 22)
  g.fillStyle = '#202522'
  g.textAlign = 'center'
  g.font = '700 54px Georgia, serif'
  g.fillText((p.brand.trim()[0] ?? '?').toUpperCase(), 96, 82)
  g.font = '600 17px system-ui, sans-serif'
  g.fillText(truncate(p.name.en, 20), 96, 112)
  g.font = '500 15px system-ui, sans-serif'
  g.fillStyle = '#4a504b'
  g.fillText(truncate(`${p.brand} · ${p.unit}`, 24), 96, 138)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  cache.set(p.id, t)
  return t
}

export function disposePackTextures() {
  cache.forEach((t) => t.dispose())
  cache.clear()
}
