import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

/** Scene colours — the brand palette, nudged slightly for lit materials. */
export const C = {
  forest: '#0f2a43',
  limestone: '#e3edf6',
  botanical: '#7fd3c1',
  terracotta: '#ee5a36',
  olive: '#0b8079',
  cream: '#f4f8fc',
  charcoal: '#1b2b3c',
  asphalt: '#37414f',
  paving: '#e4ecef',
  ground: '#d3e6e1',
  glass: '#2c3a38',
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
  g.fillStyle = '#dcd6c6'
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
  supermarket: '#0b8079',
  provision: '#ee5a36',
  fruit_veg: '#2f9e5b',
  bakery: '#e0457b',
  dairy: '#2f9fd6',
  household: '#5b6cff',
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
