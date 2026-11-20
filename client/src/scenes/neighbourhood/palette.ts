import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

/** Scene colours — the brand palette, nudged slightly for lit materials. */
export const C = {
  forest: '#202522',
  limestone: '#e9e5d9',
  botanical: '#a8b89a',
  terracotta: '#c98255',
  olive: '#77856b',
  cream: '#f5f2ea',
  charcoal: '#292c29',
  asphalt: '#3b3e3a',
  paving: '#d8d2c1',
  ground: '#cfcab9',
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
