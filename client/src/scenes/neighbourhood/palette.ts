import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

/** Scene colours — the brand palette, nudged slightly for lit materials. */
export const C = {
  forest: '#2b1a12',
  limestone: '#f3e4c8',
  botanical: '#a9cf8a',
  terracotta: '#d94f2b',
  olive: '#3f7a3a',
  cream: '#fff6e5',
  charcoal: '#3a2a20',
  asphalt: '#3b3430',
  paving: '#eadfca',
  ground: '#e6d8bd',
  glass: '#3a2e28',
}

/** Facade texture: wall with a regular window grid. Repeat is set per use. */
export function makeFacadeTexture(wall = '#e6e0d1', win = '#3a4643'): CanvasTexture {
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = wall
  g.fillRect(0, 0, size, size)
  // two windows per floor segment, with a slim slab line
  g.fillStyle = win
  const ww = 34
  const wh = 54
  g.fillRect(14, 36, ww, wh)
  g.fillRect(size - 14 - ww, 36, ww, wh)
  g.fillStyle = 'rgba(0,0,0,0.12)'
  g.fillRect(0, size - 6, size, 6)
  g.fillStyle = 'rgba(255,255,255,0.18)'
  g.fillRect(14, 36, ww, 4)
  g.fillRect(size - 14 - ww, 36, ww, 4)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Paving texture for the plaza: soft tile joints. */
export function makePavingTexture(): CanvasTexture {
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = '#e2d3b4'
  g.fillRect(0, 0, size, size)
  g.strokeStyle = 'rgba(60,60,50,0.18)'
  g.lineWidth = 2
  g.strokeRect(1, 1, size - 2, size - 2)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Shop colour by category: the same hue on the awning, fascia, beacon and (inside) the signage. */
export const CAT_COLOR = {
  supermarket: '#3f7a3a',
  provision: '#d94f2b',
  fruit_veg: '#2f9e5b',
  bakery: '#e0457b',
  dairy: '#2fa4c4',
  household: '#7a4fd0',
} as const

/** Illuminated shop name board (English over Tamil). */
export function makeNameBoard(en: string, ta: string, bg: string, fg = '#ffffff'): CanvasTexture {
  const w = 1024
  const h = 256
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, bg)
  grad.addColorStop(1, bg)
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(255,255,255,0.14)'
  g.fillRect(0, 0, w, h * 0.46)
  g.strokeStyle = fg
  g.globalAlpha = 0.55
  g.lineWidth = 6
  g.strokeRect(10, 10, w - 20, h - 20)
  g.globalAlpha = 1
  g.fillStyle = fg
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  let size = 112
  const face = '"Inter Variable", Inter, system-ui, sans-serif'
  g.font = `800 ${size}px ${face}`
  while (size > 40 && g.measureText(en).width > w - 90) {
    size -= 4
    g.font = `800 ${size}px ${face}`
  }
  g.fillText(en, w / 2, h * 0.4)
  let ts = 62
  g.font = `600 ${ts}px "Noto Sans Tamil", sans-serif`
  while (ts > 26 && g.measureText(ta).width > w - 90) {
    ts -= 3
    g.font = `600 ${ts}px "Noto Sans Tamil", sans-serif`
  }
  g.fillText(ta, w / 2, h * 0.76)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}
