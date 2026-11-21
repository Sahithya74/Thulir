import type { PackDesign, PackSource } from './packDesign'

type G = CanvasRenderingContext2D

/**
 * "What is inside": a see-through window on the pack showing a heap of the actual product — salt crystals, rice
 * grains, lentils, powders — painted particle by particle. It is why a salt pack reads as salt at a glance.
 */
export type HeapKind =
  | 'salt'
  | 'sugar'
  | 'rice'
  | 'flakes'
  | 'toor'
  | 'urad'
  | 'moong'
  | 'ragi'
  | 'flour'
  | 'sago'
  | 'chilli'
  | 'turmeric'
  | 'masala'
  | 'coffee'
  | 'tea'
  | 'seeds'

const RULES: [RegExp, HeapKind][] = [
  [/salt/, 'salt'],
  [/sugar/, 'sugar'],
  [/poha|beaten rice/, 'flakes'],
  [/rice/, 'rice'],
  [/urad/, 'urad'],
  [/moong/, 'moong'],
  [/\bdal\b|paruppu/, 'toor'],
  [/ragi/, 'ragi'],
  [/atta|flour/, 'flour'],
  [/sago/, 'sago'],
  [/chilli powder/, 'chilli'],
  [/turmeric/, 'turmeric'],
  [/sambar|rasam|masala powder/, 'masala'],
  [/filter coffee|coffee powder|^coffee/, 'coffee'],
  [/\btea\b(?!.*rusk)/, 'tea'],
  [/fennel|jeera|cumin|mustard/, 'seeds'],
]

/** Which product, if any, should be shown as a heap in a window on its pack. */
export function heapKindFor(p: PackSource, d: PackDesign): HeapKind | null {
  const n = p.name.en.toLowerCase()
  if (/rusk|biscuit|cookie|cake|bread|noodle|chips|bhujia|murukku|batter|cold coffee/.test(n)) return null
  if (d.kind === 'bottle-oil' || d.kind === 'bottle-pet' || d.kind === 'bottle-flip' || d.kind === 'bottle-spray' || d.kind === 'jar' || d.kind === 'tub' || d.kind === 'can') return null
  for (const [re, k] of RULES) if (re.test(n)) return k
  return null
}

function rand(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

interface Look {
  /** Heap body colour behind the particles. */
  base: string
  parts: string[]
  /** Particle size relative to the window width. */
  size: number
  shape: 'cube' | 'grain' | 'lens' | 'round' | 'flake' | 'dust' | 'leaf' | 'crystal' | 'bean'
  /** How densely to scatter (1 = default). */
  dense?: number
  /** Window backing (the inside of the pack). */
  back?: string
}

const LOOK: Record<HeapKind, Look> = {
  salt: { base: '#e8eef7', parts: ['#ffffff', '#f4f7fc', '#dfe8f4', '#cdd9ea', '#ffffff'], size: 0.026, shape: 'cube', dense: 1.5 },
  sugar: { base: '#eceff6', parts: ['#ffffff', '#f8faff', '#e8edf6', '#dbe3f0'], size: 0.032, shape: 'crystal', dense: 1.3 },
  rice: { base: '#e8dcc0', parts: ['#fbf6e8', '#f3ead0', '#eadfc0', '#fffaf0'], size: 0.05, shape: 'grain', dense: 1 },
  flakes: { base: '#f0e0a8', parts: ['#fbf0c6', '#f4e3a0', '#ead58a', '#fff6d6'], size: 0.05, shape: 'flake', dense: 0.9 },
  toor: { base: '#d9a416', parts: ['#f6cf4a', '#e8b523', '#f9dc72', '#d9a416'], size: 0.04, shape: 'lens', dense: 1 },
  urad: { base: '#e4d8b4', parts: ['#f6efd6', '#ebe0be', '#fffaf0', '#d9cca3'], size: 0.04, shape: 'lens', dense: 1 },
  moong: { base: '#7fa634', parts: ['#a6cb52', '#8cb83c', '#c6e07e', '#6f9a2c'], size: 0.036, shape: 'lens', dense: 1.1 },
  ragi: { base: '#6b2a18', parts: ['#8f3b21', '#a24c2c', '#74301b', '#5a2112'], size: 0.02, shape: 'round', dense: 1.8 },
  flour: { base: '#ecd49a', parts: ['#f6e6bc', '#efd9a2', '#e3c685', '#fbf0d4'], size: 0.012, shape: 'dust', dense: 3 },
  sago: { base: '#ece8f2', parts: ['#ffffff', '#f4f1fa', '#e6e1f0'], size: 0.035, shape: 'round', dense: 1.1 },
  chilli: { base: '#a31419', parts: ['#c8262b', '#b31c20', '#e04a3a', '#8a1015'], size: 0.012, shape: 'dust', dense: 3 },
  turmeric: { base: '#e09a0c', parts: ['#f5b82a', '#eaa50f', '#fbcf5a', '#c98607'], size: 0.012, shape: 'dust', dense: 3 },
  masala: { base: '#b44a15', parts: ['#cf6a24', '#b95218', '#e08a3c', '#8f3a0e', '#5a2a10'], size: 0.014, shape: 'dust', dense: 2.6 },
  coffee: { base: '#35200f', parts: ['#4e2f19', '#3a2211', '#63401f', '#2a190c'], size: 0.018, shape: 'bean', dense: 2.2 },
  tea: { base: '#33220f', parts: ['#4d3416', '#3a2710', '#6a4a22', '#2a1c0b'], size: 0.03, shape: 'leaf', dense: 1.4 },
  seeds: { base: '#8c9640', parts: ['#a8b454', '#8a9640', '#c2cb78', '#74802f'], size: 0.03, shape: 'grain', dense: 1.2 },
}

function particle(g: G, look: Look, x: number, y: number, s: number, c: string, R: () => number) {
  const rot = R() * Math.PI * 2
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  switch (look.shape) {
    case 'cube': {
      const a = s * (0.7 + R() * 0.6)
      g.fillStyle = 'rgba(40,60,90,0.25)'
      g.fillRect(-a / 2 + a * 0.12, -a / 2 + a * 0.16, a, a)
      g.fillStyle = c
      g.fillRect(-a / 2, -a / 2, a, a)
      g.fillStyle = 'rgba(255,255,255,0.9)'
      g.fillRect(-a / 2, -a / 2, a * 0.45, a * 0.3)
      break
    }
    case 'crystal': {
      const a = s * (0.7 + R() * 0.7)
      g.fillStyle = 'rgba(60,80,120,0.2)'
      g.beginPath()
      g.moveTo(-a * 0.5 + a * 0.1, -a * 0.2 + a * 0.15)
      g.lineTo(a * 0.1 + a * 0.1, -a * 0.55 + a * 0.15)
      g.lineTo(a * 0.55 + a * 0.1, a * 0.1 + a * 0.15)
      g.lineTo(-a * 0.1 + a * 0.1, a * 0.5 + a * 0.15)
      g.closePath()
      g.fill()
      g.fillStyle = c
      g.beginPath()
      g.moveTo(-a * 0.5, -a * 0.2)
      g.lineTo(a * 0.1, -a * 0.55)
      g.lineTo(a * 0.55, a * 0.1)
      g.lineTo(-a * 0.1, a * 0.5)
      g.closePath()
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.85)'
      g.fillRect(-a * 0.15, -a * 0.3, a * 0.22, a * 0.12)
      break
    }
    case 'grain': {
      const l = s * (1.4 + R() * 0.5)
      g.fillStyle = 'rgba(70,50,20,0.28)'
      g.beginPath()
      g.ellipse(s * 0.1, s * 0.14, l / 2, s / 3, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = c
      g.beginPath()
      g.ellipse(0, 0, l / 2, s / 3, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.45)'
      g.beginPath()
      g.ellipse(-l * 0.1, -s * 0.1, l * 0.28, s * 0.09, 0, 0, Math.PI * 2)
      g.fill()
      break
    }
    case 'lens': {
      const l = s * (0.9 + R() * 0.3)
      g.fillStyle = 'rgba(40,30,10,0.3)'
      g.beginPath()
      g.ellipse(s * 0.1, s * 0.14, l / 2, l / 2.4, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = c
      g.beginPath()
      g.ellipse(0, 0, l / 2, l / 2.4, 0, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.18)'
      g.lineWidth = Math.max(0.5, s * 0.06)
      g.beginPath()
      g.moveTo(-l * 0.4, 0)
      g.lineTo(l * 0.4, 0)
      g.stroke()
      g.fillStyle = 'rgba(255,255,255,0.4)'
      g.beginPath()
      g.ellipse(-l * 0.12, -l * 0.14, l * 0.14, l * 0.07, 0, 0, Math.PI * 2)
      g.fill()
      break
    }
    case 'round': {
      g.fillStyle = 'rgba(0,0,0,0.25)'
      g.beginPath()
      g.arc(s * 0.1, s * 0.14, s / 2, 0, Math.PI * 2)
      g.fill()
      const gr = g.createRadialGradient(-s * 0.15, -s * 0.18, 0, 0, 0, s / 2)
      gr.addColorStop(0, '#ffffffcc')
      gr.addColorStop(0.35, c)
      gr.addColorStop(1, c)
      g.fillStyle = gr
      g.beginPath()
      g.arc(0, 0, s / 2, 0, Math.PI * 2)
      g.fill()
      break
    }
    case 'flake': {
      const a = s * (0.9 + R() * 0.5)
      g.fillStyle = 'rgba(80,60,20,0.25)'
      g.fillRect(-a / 2 + a * 0.08, -a * 0.18 + a * 0.12, a, a * 0.36)
      g.fillStyle = c
      g.beginPath()
      g.moveTo(-a / 2, -a * 0.12)
      g.lineTo(a * 0.3, -a * 0.2)
      g.lineTo(a / 2, a * 0.1)
      g.lineTo(-a * 0.25, a * 0.2)
      g.closePath()
      g.fill()
      break
    }
    case 'bean': {
      const l = s * (1 + R() * 0.8)
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.beginPath()
      g.ellipse(s * 0.1, s * 0.12, l / 2, l / 2.6, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = c
      g.beginPath()
      g.ellipse(0, 0, l / 2, l / 2.6, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.14)'
      g.fillRect(-l * 0.3, -l * 0.12, l * 0.3, l * 0.08)
      break
    }
    case 'leaf': {
      const l = s * (1.2 + R() * 1.1)
      g.strokeStyle = 'rgba(0,0,0,0.35)'
      g.lineWidth = s * 0.34
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(-l / 2, 0)
      g.quadraticCurveTo(0, (R() - 0.5) * l * 0.7, l / 2, 0)
      g.stroke()
      g.strokeStyle = c
      g.lineWidth = s * 0.26
      g.beginPath()
      g.moveTo(-l / 2, 0)
      g.quadraticCurveTo(0, (R() - 0.5) * l * 0.7, l / 2, 0)
      g.stroke()
      break
    }
    default: {
      // dust: a speck
      g.fillStyle = c
      g.globalAlpha = 0.9
      g.fillRect(-s / 2, -s / 2, s, s)
      g.globalAlpha = 1
    }
  }
  g.restore()
}

/** Paint the window: backing, a mound of product filling the lower part, a glass sheen and a frame. */
export function drawHeapWindow(g: G, kind: HeapKind, x: number, y: number, w: number, h: number, seed: number) {
  const look = LOOK[kind]
  const R = rand(seed * 31 + kind.length * 7)
  const r = Math.min(w, h) * 0.12
  g.save()
  // clip to the rounded window
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
  g.clip()

  // the empty top of the pack inside (slightly dim), then the heap
  const back = g.createLinearGradient(x, y, x, y + h)
  back.addColorStop(0, 'rgba(255,255,255,0.55)')
  back.addColorStop(1, 'rgba(255,255,255,0.2)')
  g.fillStyle = '#f6f4ee'
  g.fillRect(x, y, w, h)
  g.fillStyle = back
  g.fillRect(x, y, w, h)

  const peakY = y + h * 0.16
  const mound = () => {
    g.beginPath()
    g.moveTo(x - 2, y + h + 2)
    g.lineTo(x - 2, y + h * 0.78)
    g.bezierCurveTo(x + w * 0.2, y + h * 0.7, x + w * 0.32, peakY, x + w * 0.5, peakY)
    g.bezierCurveTo(x + w * 0.68, peakY, x + w * 0.8, y + h * 0.7, x + w + 2, y + h * 0.78)
    g.lineTo(x + w + 2, y + h + 2)
    g.closePath()
  }
  mound()
  const fill = g.createLinearGradient(x, peakY, x, y + h)
  fill.addColorStop(0, look.base)
  fill.addColorStop(1, look.base)
  g.fillStyle = fill
  g.fill()

  g.save()
  mound()
  g.clip()
  const s = w * look.size
  const n = Math.min(2600, Math.round(((w * h) / (s * s)) * 1.1 * (look.dense ?? 1)))
  // paint back to front: higher particles first so lower ones overlap them
  const pts: { px: number; py: number }[] = []
  for (let i = 0; i < n; i++) pts.push({ px: x + R() * w, py: peakY + R() * (y + h - peakY) })
  pts.sort((a, b) => a.py - b.py)
  for (const p of pts) particle(g, look, p.px, p.py, s * (0.8 + R() * 0.45), look.parts[Math.floor(R() * look.parts.length)], R)
  // light from the upper left, shade lower right and in the hollow
  const light = g.createLinearGradient(x, y, x + w, y + h)
  light.addColorStop(0, 'rgba(255,255,255,0.22)')
  light.addColorStop(0.55, 'rgba(255,255,255,0)')
  light.addColorStop(1, 'rgba(0,0,0,0.28)')
  g.fillStyle = light
  g.fillRect(x, y, w, h)
  g.restore()

  // glass sheen across the window
  const sheen = g.createLinearGradient(x, y, x + w, y + h)
  sheen.addColorStop(0, 'rgba(255,255,255,0.35)')
  sheen.addColorStop(0.28, 'rgba(255,255,255,0.05)')
  sheen.addColorStop(0.32, 'rgba(255,255,255,0.22)')
  sheen.addColorStop(0.42, 'rgba(255,255,255,0)')
  g.fillStyle = sheen
  g.fillRect(x, y, w, h)
  // inner shadow along the top edge
  const edge = g.createLinearGradient(x, y, x, y + h * 0.18)
  edge.addColorStop(0, 'rgba(0,0,0,0.22)')
  edge.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = edge
  g.fillRect(x, y, w, h * 0.18)
  g.restore()

  // frame
  g.save()
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
  g.strokeStyle = 'rgba(255,255,255,0.9)'
  g.lineWidth = Math.max(1.5, w * 0.018)
  g.stroke()
  g.strokeStyle = 'rgba(0,0,0,0.22)'
  g.lineWidth = Math.max(0.8, w * 0.008)
  g.stroke()
  g.restore()
}
