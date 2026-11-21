import { designFor, shade, type Motif, type PackDesign, type PackSource, type Produce } from './packDesign'
import { drawHeapWindow, heapKindFor } from './packContents'

/**
 * Canvas painter for retail packs. `paintFace` draws the printed front of a pack into any rectangle (used for the
 * 2D picture and as the 3D shelf texture); `packImageUrl` draws a whole pack — silhouette, print, light and shadow —
 * as an image for product cards. Everything is generated: no photographs, no brand artwork.
 */

type G = CanvasRenderingContext2D

const SANS = '"Inter Variable", Inter, system-ui, sans-serif'
const TAMIL = '"Noto Sans Tamil", "Inter Variable", sans-serif'

/* ------------------------------------------------------------------ fonts */

let fontsReady = false
let fontsPromise: Promise<void> | null = null

/** Canvas text only uses a web font once it has loaded; callers re-draw when this resolves. */
export function loadPackFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise
  if (typeof document === 'undefined' || !('fonts' in document)) {
    fontsReady = true
    fontsPromise = Promise.resolve()
    return fontsPromise
  }
  fontsPromise = Promise.all([
    document.fonts.load('800 24px "Inter Variable"'),
    document.fonts.load('italic 800 24px "Inter Variable"'),
    document.fonts.load('600 24px "Noto Sans Tamil"', 'தமிழ்'),
  ])
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      fontsReady = true
    })
  return fontsPromise
}
export const packFontsReady = () => fontsReady

/* ------------------------------------------------------------------ helpers */

function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + k, y)
  g.arcTo(x + w, y, x + w, y + h, k)
  g.arcTo(x + w, y + h, x, y + h, k)
  g.arcTo(x, y + h, x, y, k)
  g.arcTo(x, y, x + w, y, k)
  g.closePath()
}

function fitFont(g: G, text: string, maxW: number, size: number, weight: string, family: string, min = 6): number {
  let s = size
  g.font = `${weight} ${s}px ${family}`
  while (s > min && g.measureText(text).width > maxW) {
    s -= 0.5
    g.font = `${weight} ${s}px ${family}`
  }
  return s
}

/** Wrap into at most `max` lines, shrinking the font if a word still does not fit. */
function wrap(g: G, text: string, maxW: number, size: number, weight: string, family: string, max = 2): { lines: string[]; size: number } {
  for (let s = size; s >= 6; s -= 0.5) {
    g.font = `${weight} ${s}px ${family}`
    const words = text.split(/\s+/)
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w
      if (g.measureText(t).width <= maxW) cur = t
      else {
        if (cur) lines.push(cur)
        cur = w
      }
    }
    if (cur) lines.push(cur)
    if (lines.length <= max && lines.every((l) => g.measureText(l).width <= maxW)) return { lines, size: s }
  }
  g.font = `${weight} 6px ${family}`
  return { lines: [text], size: 6 }
}

function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function rand(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Light from the upper left: highlight band and darker edges, clipped to whatever path is current. */
function volume(g: G, x: number, w: number, y: number, h: number, strength = 1) {
  const gr = g.createLinearGradient(x, 0, x + w, 0)
  gr.addColorStop(0, `rgba(0,0,0,${0.22 * strength})`)
  gr.addColorStop(0.12, `rgba(255,255,255,${0.1 * strength})`)
  gr.addColorStop(0.24, `rgba(255,255,255,${0.26 * strength})`)
  gr.addColorStop(0.36, 'rgba(255,255,255,0)')
  gr.addColorStop(0.78, 'rgba(0,0,0,0.03)')
  gr.addColorStop(1, `rgba(0,0,0,${0.3 * strength})`)
  g.fillStyle = gr
  g.fillRect(x, y, w, h)
}

function vegMark(g: G, x: number, y: number, s: number, veg: boolean) {
  const c = veg ? '#2f8a3a' : '#a3281f'
  g.fillStyle = '#ffffff'
  g.fillRect(x, y, s, s)
  g.strokeStyle = c
  g.lineWidth = Math.max(1, s * 0.1)
  g.strokeRect(x, y, s, s)
  g.fillStyle = c
  g.beginPath()
  g.arc(x + s / 2, y + s / 2, s * 0.26, 0, Math.PI * 2)
  g.fill()
}

/* ------------------------------------------------------------------ patterns */

function pattern(g: G, d: PackDesign, x: number, y: number, w: number, h: number) {
  const ink = d.ink === '#ffffff' ? 'rgba(255,255,255,' : 'rgba(0,0,0,'
  g.save()
  switch (d.pattern) {
    case 'dots': {
      const step = Math.max(6, w * 0.075)
      g.fillStyle = `${ink}0.08)`
      for (let yy = y + step / 2; yy < y + h; yy += step)
        for (let xx = x + ((yy / step) % 2 ? step / 2 : 0); xx < x + w; xx += step) {
          g.beginPath()
          g.arc(xx, yy, step * 0.14, 0, Math.PI * 2)
          g.fill()
        }
      break
    }
    case 'stripes': {
      g.strokeStyle = `${ink}0.07)`
      g.lineWidth = Math.max(2, w * 0.04)
      for (let i = -h; i < w + h; i += w * 0.12) {
        g.beginPath()
        g.moveTo(x + i, y)
        g.lineTo(x + i + h, y + h)
        g.stroke()
      }
      break
    }
    case 'waves': {
      g.strokeStyle = alpha(d.accent, 0.22)
      g.lineWidth = Math.max(1.5, h * 0.012)
      for (let k = 0; k < 3; k++) {
        const yy = y + h * (0.86 + k * 0.045)
        g.beginPath()
        for (let xx = 0; xx <= w; xx += 3) g.lineTo(x + xx, yy + Math.sin(xx / (w * 0.08) + k) * h * 0.012)
        g.stroke()
      }
      break
    }
    case 'grid': {
      g.strokeStyle = `${ink}0.06)`
      g.lineWidth = 1
      const step = Math.max(8, w * 0.1)
      for (let xx = x; xx < x + w; xx += step) {
        g.beginPath()
        g.moveTo(xx, y)
        g.lineTo(xx, y + h)
        g.stroke()
      }
      for (let yy = y; yy < y + h; yy += step) {
        g.beginPath()
        g.moveTo(x, yy)
        g.lineTo(x + w, yy)
        g.stroke()
      }
      break
    }
  }
  g.restore()
}

/* ------------------------------------------------------------------ motifs */

function ellipse(g: G, x: number, y: number, rx: number, ry: number, rot: number, fill: string | CanvasGradient, stroke?: string) {
  g.beginPath()
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
  g.fillStyle = fill
  g.fill()
  if (stroke) {
    g.strokeStyle = stroke
    g.lineWidth = Math.max(0.6, rx * 0.12)
    g.stroke()
  }
}

function leafShape(g: G, x: number, y: number, len: number, rot: number, fill: string) {
  g.save()
  g.translate(x, y)
  g.rotate(rot)
  g.beginPath()
  g.moveTo(0, 0)
  g.quadraticCurveTo(len * 0.5, -len * 0.38, len, 0)
  g.quadraticCurveTo(len * 0.5, len * 0.38, 0, 0)
  g.fillStyle = fill
  g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.35)'
  g.lineWidth = Math.max(0.6, len * 0.04)
  g.beginPath()
  g.moveTo(len * 0.05, 0)
  g.lineTo(len * 0.9, 0)
  g.stroke()
  g.restore()
}

function star(g: G, x: number, y: number, r: number, fill: string) {
  g.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    const rr2 = i % 2 ? r * 0.28 : r
    g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2)
  }
  g.closePath()
  g.fillStyle = fill
  g.fill()
}

export function drawMotif(g: G, m: Motif, d: PackDesign, cx: number, cy: number, r: number) {
  const R = rand(d.seed)
  g.save()
  switch (m) {
    case 'grain':
      for (let i = 0; i < 16; i++) {
        const a = R() * Math.PI * 2
        const dist = Math.sqrt(R()) * r * 0.62
        ellipse(g, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, r * 0.15, r * 0.055, R() * Math.PI, '#fffdf6', 'rgba(120,100,70,0.45)')
      }
      break
    case 'lentil': {
      g.beginPath()
      g.ellipse(cx, cy + r * 0.22, r * 0.72, r * 0.42, 0, 0, Math.PI)
      g.fillStyle = '#8b4a26'
      g.fill()
      const lc = d.base === '#f1ece1' ? '#f4efe4' : shade(d.base, 0.1)
      for (let i = 0; i < 22; i++) {
        const t = i / 22
        const x = cx + (R() - 0.5) * r * 1.25
        const y = cy + r * 0.2 - Math.sin(t * Math.PI) * 0 - R() * r * 0.42 * (1 - Math.abs(x - cx) / (r * 0.7))
        ellipse(g, x, y, r * 0.11, r * 0.09, 0, lc, shade(lc, -0.3))
      }
      break
    }
    case 'wheat':
      g.strokeStyle = '#a8741f'
      g.lineWidth = r * 0.06
      for (const off of [-0.25, 0, 0.25]) {
        g.save()
        g.translate(cx + off * r, cy + r * 0.7)
        g.rotate(off * 0.6)
        g.beginPath()
        g.moveTo(0, 0)
        g.lineTo(0, -r * 1.25)
        g.stroke()
        for (let k = 0; k < 5; k++) {
          ellipse(g, -r * 0.09, -r * (0.45 + k * 0.17), r * 0.1, r * 0.055, -0.6, '#d9a23a', '#9c6a1c')
          ellipse(g, r * 0.09, -r * (0.45 + k * 0.17), r * 0.1, r * 0.055, 0.6, '#d9a23a', '#9c6a1c')
        }
        g.restore()
      }
      break
    case 'drop': {
      const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
      gr.addColorStop(0, '#ffe08a')
      gr.addColorStop(1, '#d48d10')
      g.beginPath()
      g.moveTo(cx, cy - r * 0.8)
      g.bezierCurveTo(cx + r * 0.65, cy - r * 0.05, cx + r * 0.6, cy + r * 0.7, cx, cy + r * 0.7)
      g.bezierCurveTo(cx - r * 0.6, cy + r * 0.7, cx - r * 0.65, cy - r * 0.05, cx, cy - r * 0.8)
      g.fillStyle = gr
      g.fill()
      ellipse(g, cx - r * 0.2, cy + r * 0.15, r * 0.09, r * 0.2, 0.3, 'rgba(255,255,255,0.7)')
      break
    }
    case 'bean':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4
        const x = cx + Math.cos(a) * r * 0.42
        const y = cy + Math.sin(a) * r * 0.42
        ellipse(g, x, y, r * 0.26, r * 0.18, a, '#6b3a1f', '#3b1d0e')
        g.strokeStyle = '#2a1408'
        g.lineWidth = r * 0.04
        g.beginPath()
        g.moveTo(x - Math.cos(a) * r * 0.2, y - Math.sin(a) * r * 0.2)
        g.quadraticCurveTo(x + Math.sin(a) * r * 0.05, y - Math.cos(a) * r * 0.05, x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2)
        g.stroke()
      }
      break
    case 'leaf':
      leafShape(g, cx - r * 0.55, cy + r * 0.3, r * 1.1, -0.6, '#3f8f3a')
      leafShape(g, cx - r * 0.35, cy + r * 0.45, r * 0.95, -1.4, '#64ad45')
      leafShape(g, cx - r * 0.2, cy + r * 0.2, r * 0.8, 0.1, '#2e7230')
      break
    case 'chilli':
      g.save()
      g.translate(cx, cy)
      g.rotate(-0.5)
      g.beginPath()
      g.moveTo(-r * 0.7, -r * 0.05)
      g.quadraticCurveTo(0, -r * 0.35, r * 0.75, r * 0.25)
      g.quadraticCurveTo(0, r * 0.2, -r * 0.7, r * 0.15)
      g.closePath()
      g.fillStyle = '#d4211b'
      g.fill()
      g.fillStyle = '#3f8f3a'
      g.fillRect(-r * 0.85, -r * 0.06, r * 0.2, r * 0.16)
      ellipse(g, -r * 0.2, -r * 0.08, r * 0.25, r * 0.04, -0.15, 'rgba(255,255,255,0.45)')
      g.restore()
      break
    case 'sun':
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2
        ellipse(g, cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.3, r * 0.12, a, '#f7c21d')
      }
      ellipse(g, cx, cy, r * 0.38, r * 0.38, 0, '#6b3a17')
      for (let i = 0; i < 12; i++) ellipse(g, cx + (R() - 0.5) * r * 0.5, cy + (R() - 0.5) * r * 0.5, r * 0.04, r * 0.04, 0, '#3b1d0e')
      break
    case 'wave':
      g.strokeStyle = '#1f7bd1'
      g.lineWidth = r * 0.1
      for (let k = 0; k < 3; k++) {
        g.beginPath()
        for (let x = -r * 0.8; x <= r * 0.8; x += 2) g.lineTo(cx + x, cy + r * (k * 0.3 - 0.15) + Math.sin(x / (r * 0.18)) * r * 0.08)
        g.stroke()
      }
      break
    case 'bubbles':
      for (let i = 0; i < 7; i++) {
        const br = r * (0.14 + R() * 0.22)
        const x = cx + (R() - 0.5) * r * 1.2
        const y = cy + (R() - 0.5) * r * 1.2
        const gr = g.createRadialGradient(x - br * 0.3, y - br * 0.3, br * 0.1, x, y, br)
        gr.addColorStop(0, 'rgba(255,255,255,0.95)')
        gr.addColorStop(0.7, 'rgba(180,220,255,0.55)')
        gr.addColorStop(1, 'rgba(90,150,230,0.7)')
        ellipse(g, x, y, br, br, 0, gr)
      }
      break
    case 'tooth':
      g.beginPath()
      g.moveTo(cx - r * 0.5, cy - r * 0.45)
      g.bezierCurveTo(cx - r * 0.2, cy - r * 0.65, cx + r * 0.2, cy - r * 0.65, cx + r * 0.5, cy - r * 0.45)
      g.bezierCurveTo(cx + r * 0.6, cy, cx + r * 0.35, cy + r * 0.2, cx + r * 0.3, cy + r * 0.65)
      g.lineTo(cx + r * 0.12, cy + r * 0.2)
      g.lineTo(cx - r * 0.12, cy + r * 0.2)
      g.lineTo(cx - r * 0.3, cy + r * 0.65)
      g.bezierCurveTo(cx - r * 0.35, cy + r * 0.2, cx - r * 0.6, cy, cx - r * 0.5, cy - r * 0.45)
      g.fillStyle = '#ffffff'
      g.fill()
      g.strokeStyle = '#7fb7ea'
      g.lineWidth = r * 0.06
      g.stroke()
      star(g, cx + r * 0.55, cy - r * 0.55, r * 0.22, '#7fd0ff')
      break
    case 'sparkle':
      star(g, cx, cy, r * 0.6, d.accent)
      star(g, cx + r * 0.55, cy - r * 0.45, r * 0.25, shade(d.accent, 0.3))
      star(g, cx - r * 0.5, cy + r * 0.45, r * 0.2, shade(d.accent, 0.3))
      break
    case 'cookie':
      for (const [ox, oy, s] of [[-0.3, 0.15, 0.55], [0.3, -0.1, 0.5]] as const) {
        ellipse(g, cx + ox * r, cy + oy * r, r * s, r * s, 0, '#d99543', '#9c5f1e')
        for (let i = 0; i < 6; i++) ellipse(g, cx + ox * r + (R() - 0.5) * r * s, cy + oy * r + (R() - 0.5) * r * s, r * 0.05, r * 0.05, 0, '#7a4314')
      }
      break
    case 'chip':
      for (let i = 0; i < 4; i++) {
        g.save()
        g.translate(cx + (i - 1.5) * r * 0.32, cy + (i % 2 ? -1 : 1) * r * 0.15)
        g.rotate((i - 1.5) * 0.4)
        g.beginPath()
        g.moveTo(-r * 0.32, 0)
        g.bezierCurveTo(-r * 0.2, -r * 0.42, r * 0.25, -r * 0.4, r * 0.34, -r * 0.02)
        g.bezierCurveTo(r * 0.22, r * 0.32, -r * 0.22, r * 0.34, -r * 0.32, 0)
        g.fillStyle = i % 2 ? '#f6c84a' : '#f2b631'
        g.fill()
        g.strokeStyle = '#c98a14'
        g.lineWidth = r * 0.03
        g.stroke()
        g.restore()
      }
      break
    case 'milk':
      g.beginPath()
      g.moveTo(cx - r * 0.8, cy + r * 0.25)
      for (let i = 0; i <= 8; i++) {
        const x = cx - r * 0.8 + (i / 8) * r * 1.6
        g.quadraticCurveTo(x - r * 0.1, cy - r * (i % 2 ? 0.55 : 0.15), x, cy + r * 0.05)
      }
      g.lineTo(cx + r * 0.8, cy + r * 0.6)
      g.lineTo(cx - r * 0.8, cy + r * 0.6)
      g.closePath()
      g.fillStyle = '#ffffff'
      g.fill()
      g.strokeStyle = 'rgba(70,120,200,0.35)'
      g.lineWidth = r * 0.04
      g.stroke()
      ellipse(g, cx + r * 0.25, cy - r * 0.6, r * 0.1, r * 0.13, 0, '#ffffff', 'rgba(70,120,200,0.35)')
      break
    case 'cup':
      ellipse(g, cx, cy + r * 0.5, r * 0.75, r * 0.15, 0, '#f4ecdc', '#b8a27c')
      g.beginPath()
      g.moveTo(cx - r * 0.5, cy - r * 0.15)
      g.lineTo(cx + r * 0.5, cy - r * 0.15)
      g.quadraticCurveTo(cx + r * 0.45, cy + r * 0.45, cx, cy + r * 0.45)
      g.quadraticCurveTo(cx - r * 0.45, cy + r * 0.45, cx - r * 0.5, cy - r * 0.15)
      g.fillStyle = '#ffffff'
      g.fill()
      ellipse(g, cx, cy - r * 0.15, r * 0.5, r * 0.1, 0, '#a8541c')
      g.strokeStyle = 'rgba(255,255,255,0.8)'
      g.lineWidth = r * 0.06
      for (const ox of [-0.18, 0.12]) {
        g.beginPath()
        g.moveTo(cx + ox * r, cy - r * 0.3)
        g.bezierCurveTo(cx + (ox - 0.15) * r, cy - r * 0.5, cx + (ox + 0.15) * r, cy - r * 0.6, cx + ox * r, cy - r * 0.85)
        g.stroke()
      }
      break
    case 'fruit':
      ellipse(g, cx - r * 0.25, cy + r * 0.1, r * 0.45, r * 0.45, 0, '#ff9f1a', '#d96f00')
      for (let i = 0; i < 8; i++) {
        g.strokeStyle = 'rgba(255,240,200,0.8)'
        g.lineWidth = r * 0.03
        g.beginPath()
        g.moveTo(cx - r * 0.25, cy + r * 0.1)
        g.lineTo(cx - r * 0.25 + Math.cos((i / 8) * Math.PI * 2) * r * 0.4, cy + r * 0.1 + Math.sin((i / 8) * Math.PI * 2) * r * 0.4)
        g.stroke()
      }
      ellipse(g, cx + r * 0.35, cy - r * 0.15, r * 0.38, r * 0.4, 0, '#d4211b')
      leafShape(g, cx + r * 0.35, cy - r * 0.55, r * 0.4, -0.8, '#3f8f3a')
      break
    case 'salt':
      for (let i = 0; i < 10; i++) {
        const s = r * (0.12 + R() * 0.12)
        g.save()
        g.translate(cx + (R() - 0.5) * r * 1.2, cy + (R() - 0.3) * r)
        g.rotate(R())
        g.fillStyle = '#ffffff'
        g.strokeStyle = '#9dbbe0'
        g.lineWidth = s * 0.15
        g.fillRect(-s / 2, -s / 2, s, s)
        g.strokeRect(-s / 2, -s / 2, s, s)
        g.restore()
      }
      break
    case 'spice': {
      g.beginPath()
      g.moveTo(cx - r * 0.75, cy + r * 0.45)
      g.quadraticCurveTo(cx, cy - r * 0.6, cx + r * 0.75, cy + r * 0.45)
      g.closePath()
      const gr = g.createLinearGradient(cx, cy - r * 0.4, cx, cy + r * 0.45)
      gr.addColorStop(0, shade(d.base, 0.25))
      gr.addColorStop(1, shade(d.base, -0.2))
      g.fillStyle = gr
      g.fill()
      g.fillStyle = '#9a6a3a'
      g.save()
      g.translate(cx + r * 0.35, cy - r * 0.35)
      g.rotate(-0.7)
      ellipse(g, 0, 0, r * 0.22, r * 0.14, 0, '#a77746')
      g.fillRect(r * 0.18, -r * 0.03, r * 0.5, r * 0.06)
      g.restore()
      break
    }
    case 'noodle':
      ellipse(g, cx, cy + r * 0.25, r * 0.8, r * 0.35, 0, '#c4282c')
      g.strokeStyle = '#f7d36a'
      g.lineWidth = r * 0.06
      for (let k = 0; k < 4; k++) {
        g.beginPath()
        for (let x = -r * 0.6; x <= r * 0.6; x += 2) g.lineTo(cx + x, cy - r * 0.05 + k * r * 0.1 + Math.sin(x / (r * 0.08) + k) * r * 0.06)
        g.stroke()
      }
      break
    case 'cake':
      g.beginPath()
      g.moveTo(cx - r * 0.7, cy + r * 0.45)
      g.lineTo(cx + r * 0.7, cy + r * 0.45)
      g.lineTo(cx + r * 0.7, cy - r * 0.05)
      g.lineTo(cx - r * 0.2, cy - r * 0.45)
      g.lineTo(cx - r * 0.7, cy - r * 0.05)
      g.closePath()
      g.fillStyle = shade(d.base, 0.15)
      g.fill()
      g.fillStyle = '#fff3d6'
      g.fillRect(cx - r * 0.7, cy + r * 0.12, r * 1.4, r * 0.08)
      ellipse(g, cx + r * 0.2, cy - r * 0.3, r * 0.12, r * 0.12, 0, '#d4211b')
      break
    case 'bread':
      g.beginPath()
      g.moveTo(cx - r * 0.75, cy + r * 0.4)
      g.lineTo(cx - r * 0.75, cy - r * 0.05)
      g.bezierCurveTo(cx - r * 0.75, cy - r * 0.6, cx + r * 0.75, cy - r * 0.6, cx + r * 0.75, cy - r * 0.05)
      g.lineTo(cx + r * 0.75, cy + r * 0.4)
      g.closePath()
      g.fillStyle = '#c47a35'
      g.fill()
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = '#8a4f1c'
        g.lineWidth = r * 0.05
        g.beginPath()
        g.moveTo(cx - r * 0.45 + i * r * 0.35, cy - r * 0.3)
        g.lineTo(cx - r * 0.3 + i * r * 0.35, cy - r * 0.05)
        g.stroke()
      }
      break
    case 'egg':
      ellipse(g, cx - r * 0.25, cy, r * 0.36, r * 0.48, -0.2, '#f6ead6', '#c9b38f')
      ellipse(g, cx + r * 0.3, cy + r * 0.1, r * 0.34, r * 0.45, 0.2, '#e7c39a', '#b98d5c')
      break
    case 'flower':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        ellipse(g, cx + Math.cos(a) * r * 0.38, cy + Math.sin(a) * r * 0.38, r * 0.3, r * 0.2, a, shade(d.accent === '#ffffff' ? d.base : d.accent, 0.35))
      }
      ellipse(g, cx, cy, r * 0.22, r * 0.22, 0, '#f6c445')
      break
    case 'coconut':
      ellipse(g, cx, cy, r * 0.7, r * 0.7, 0, '#6b4226')
      ellipse(g, cx, cy, r * 0.55, r * 0.55, 0, '#fffdf5')
      ellipse(g, cx, cy, r * 0.4, r * 0.4, 0, '#f1ead8')
      leafShape(g, cx + r * 0.3, cy - r * 0.55, r * 0.6, -0.9, '#3f8f3a')
      break
    case 'pearl':
      for (let i = 0; i < 18; i++) ellipse(g, cx + (R() - 0.5) * r * 1.3, cy + (R() - 0.5) * r * 1.1, r * 0.1, r * 0.1, 0, '#ffffff', 'rgba(120,100,170,0.45)')
      break
    default:
      break
  }
  g.restore()
}

/* ------------------------------------------------------------------ printed face */

/** The printed front of a pack, laid out for the rectangle's shape. */
export function paintFace(g: G, p: PackSource, d: PackDesign, x: number, y: number, w: number, h: number, opts: { tamil?: boolean } = {}) {
  g.save()
  g.beginPath()
  g.rect(x, y, w, h)
  g.clip()
  const bg = g.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0, shade(d.base, 0.1))
  bg.addColorStop(1, d.base2)
  g.fillStyle = bg
  g.fillRect(x, y, w, h)
  pattern(g, d, x, y, w, h)

  const wide = w / h > 1.25
  const name = p.name.en
  const tamil = opts.tamil !== false ? p.name.ta : ''

  const brandBand = (bx: number, by: number, maxW: number, bh: number) => {
    const size = fitFont(g, p.brand, maxW - bh * 0.9, bh * 0.58, 'italic 800', SANS)
    const tw = g.measureText(p.brand).width
    const lw = Math.min(maxW, tw + bh * 0.9)
    rr(g, bx - lw / 2, by, lw, bh, bh * 0.5)
    g.fillStyle = d.accent
    g.fill()
    g.fillStyle = d.accentInk
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `italic 800 ${size}px ${SANS}`
    g.fillText(p.brand, bx, by + bh * 0.54)
  }
  const badge = (bx: number, by: number, r: number) => {
    g.beginPath()
    g.arc(bx, by, r, 0, Math.PI * 2)
    g.fillStyle = d.accent
    g.fill()
    g.strokeStyle = alpha(d.accentInk, 0.6)
    g.lineWidth = Math.max(1, r * 0.08)
    g.beginPath()
    g.arc(bx, by, r * 0.84, 0, Math.PI * 2)
    g.stroke()
    const s = fitFont(g, p.unit, r * 1.5, r * 0.62, '800', SANS)
    g.fillStyle = d.accentInk
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `800 ${s}px ${SANS}`
    g.fillText(p.unit, bx, by + r * 0.04)
  }
  const plate = (cx: number, cy: number, r: number) => {
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    g.fillStyle = d.panel
    g.fill()
    g.strokeStyle = alpha(d.accent, 0.5)
    g.lineWidth = Math.max(1, r * 0.06)
    g.stroke()
    g.save()
    g.beginPath()
    g.arc(cx, cy, r * 0.94, 0, Math.PI * 2)
    g.clip()
    drawMotif(g, d.motif, d, cx, cy, r * 0.82)
    g.restore()
  }

  g.textBaseline = 'alphabetic'
  if (!wide) {
    brandBand(x + w / 2, y + h * 0.05, w * 0.86, Math.max(8, h * 0.11))
    const r = Math.min(w * 0.3, h * 0.17)
    const heap = heapKindFor(p, d)
    if (heap) drawHeapWindow(g, heap, x + w * 0.12, y + h * 0.185, w * 0.76, h * 0.34, d.seed)
    else plate(x + w / 2, y + h * 0.36, r)
    const nm = wrap(g, name, w * 0.9, Math.min(w * 0.14, h * 0.08), '800', SANS, w < h * 0.9 ? 2 : 3)
    g.fillStyle = d.ink
    g.textAlign = 'center'
    g.font = `800 ${nm.size}px ${SANS}`
    let ty = y + h * 0.58 + nm.size
    for (const line of nm.lines) {
      g.fillText(line, x + w / 2, ty)
      ty += nm.size * 1.08
    }
    if (tamil && h > 60) {
      const ts = fitFont(g, tamil, w * 0.86, nm.size * 0.62, '600', TAMIL)
      g.globalAlpha = 0.85
      g.font = `600 ${ts}px ${TAMIL}`
      g.fillText(tamil, x + w / 2, ty + ts * 0.25)
      g.globalAlpha = 1
    }
    vegMark(g, x + w * 0.07, y + h - h * 0.11, Math.max(6, h * 0.055), p.veg)
    badge(x + w - Math.min(w, h) * 0.17, y + h - Math.min(w, h) * 0.16, Math.min(w, h) * 0.12)
  } else {
    const bh = Math.max(8, h * 0.18)
    brandBand(x + w * 0.3, y + h * 0.07, w * 0.5, bh)
    const r = h * 0.26
    plate(x + h * 0.4, y + h * 0.6, r)
    const left = x + h * 0.76
    const right = x + w - h * 0.5
    const nm = wrap(g, name, right - left, h * 0.16, '800', SANS, 3)
    g.fillStyle = d.ink
    g.textAlign = 'left'
    g.font = `800 ${nm.size}px ${SANS}`
    let ty = y + h * (nm.lines.length > 2 ? 0.34 : 0.42) + nm.size * 0.5
    for (const line of nm.lines) {
      g.fillText(line, left, ty)
      ty += nm.size * 1.08
    }
    if (tamil && h > 50) {
      const ts = fitFont(g, tamil, right - left, nm.size * 0.62, '600', TAMIL)
      g.globalAlpha = 0.85
      g.font = `600 ${ts}px ${TAMIL}`
      g.fillText(tamil, left, ty + ts * 0.2)
      g.globalAlpha = 1
    }
    vegMark(g, x + w - h * 0.2, y + h * 0.08, Math.max(6, h * 0.1), p.veg)
    badge(x + w - h * 0.27, y + h * 0.66, h * 0.2)
  }
  g.restore()
}

/* ------------------------------------------------------------------ whole packs */

function shadowAt(g: G, cx: number, y: number, rx: number) {
  const gr = g.createRadialGradient(cx, y, 0, cx, y, rx)
  gr.addColorStop(0, 'rgba(30,25,15,0.32)')
  gr.addColorStop(1, 'rgba(30,25,15,0)')
  g.fillStyle = gr
  g.beginPath()
  g.ellipse(cx, y, rx, rx * 0.16, 0, 0, Math.PI * 2)
  g.fill()
}

/** Fill a closed path with the pack colour, print the face inside it, then add light and an edge. */
function printed(g: G, path: () => void, p: PackSource, d: PackDesign, box: [number, number, number, number], face: [number, number, number, number], light = 1) {
  const [x, y, w, h] = box
  g.save()
  path()
  g.clip()
  const bg = g.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0, shade(d.base, 0.1))
  bg.addColorStop(1, d.base2)
  g.fillStyle = bg
  g.fillRect(x, y, w, h)
  paintFace(g, p, d, ...face)
  volume(g, x, w, y, h, light)
  g.restore()
  path()
  g.strokeStyle = 'rgba(0,0,0,0.18)'
  g.lineWidth = 1.2
  g.stroke()
}

function serration(g: G, x: number, y: number, w: number, h: number, color: string, teethDown: boolean) {
  g.fillStyle = color
  g.fillRect(x, y, w, h)
  g.strokeStyle = 'rgba(0,0,0,0.12)'
  g.lineWidth = 1
  for (let xx = x + 3; xx < x + w; xx += 3.5) {
    g.beginPath()
    g.moveTo(xx, y + 1)
    g.lineTo(xx, y + h - 1)
    g.stroke()
  }
  g.fillStyle = color
  const t = 5
  g.beginPath()
  const ey = teethDown ? y + h : y
  g.moveTo(x, ey)
  for (let xx = x; xx <= x + w; xx += t) {
    g.lineTo(xx + t / 2, ey + (teethDown ? 3 : -3))
    g.lineTo(xx + t, ey)
  }
  g.fill()
}

function cap(g: G, cx: number, y: number, w: number, h: number, color: string) {
  const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0)
  gr.addColorStop(0, shade(color, -0.35))
  gr.addColorStop(0.35, shade(color, 0.25))
  gr.addColorStop(1, shade(color, -0.4))
  rr(g, cx - w / 2, y, w, h, Math.min(4, w * 0.15))
  g.fillStyle = gr
  g.fill()
  g.strokeStyle = 'rgba(0,0,0,0.18)'
  g.lineWidth = 1
  for (let xx = cx - w / 2 + 3; xx < cx + w / 2; xx += 3) {
    g.beginPath()
    g.moveTo(xx, y + 2)
    g.lineTo(xx, y + h - 2)
    g.stroke()
  }
}

/* ---------------------------- produce (2D) */

function tomato(g: G, x: number, y: number, r: number, c = '#d9302c') {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
  gr.addColorStop(0, shade(c, 0.35))
  gr.addColorStop(1, shade(c, -0.25))
  ellipse(g, x, y, r, r * 0.88, 0, gr)
  star(g, x, y - r * 0.72, r * 0.38, '#3d7f2c')
}

export function drawProduce(g: G, kind: Produce, cx: number, cy: number, s: number, seed: number) {
  const R = rand(seed)
  const pile = (n: number, f: (x: number, y: number, i: number) => void, spread = 1) => {
    // Three rows, widest at the bottom; drawn back-to-front so the front row overlaps the ones behind it.
    const bottom = Math.ceil(n * 0.5)
    const middle = Math.min(n - bottom, Math.ceil((n - bottom) * 0.65))
    const counts = [bottom, middle, n - bottom - middle]
    const pts: [number, number, number][] = []
    let i = 0
    counts.forEach((count, row) => {
      for (let k = 0; k < count; k++, i++) {
        const x = cx + (k - (count - 1) / 2) * s * 0.25 * spread + (R() - 0.5) * s * 0.035
        const y = cy + s * 0.16 - row * s * 0.13 + (R() - 0.5) * s * 0.025
        pts.push([x, y, i])
      }
    })
    pts.reverse().forEach(([x, y, j]) => f(x, y, j))
  }
  switch (kind) {
    case 'tomato':
      pile(7, (x, y) => tomato(g, x, y, s * 0.13))
      break
    case 'apple':
      pile(6, (x, y) => {
        tomato(g, x, y, s * 0.14, '#c4232f')
        g.strokeStyle = '#5b3a1e'
        g.lineWidth = s * 0.012
        g.beginPath()
        g.moveTo(x, y - s * 0.1)
        g.lineTo(x + s * 0.02, y - s * 0.17)
        g.stroke()
        leafShape(g, x + s * 0.02, y - s * 0.15, s * 0.08, -0.5, '#3f8f3a')
      })
      break
    case 'onion':
      pile(6, (x, y) => {
        const gr = g.createRadialGradient(x - s * 0.04, y - s * 0.04, 1, x, y, s * 0.14)
        gr.addColorStop(0, '#d47a96')
        gr.addColorStop(1, '#73293f')
        g.beginPath()
        g.moveTo(x, y - s * 0.19)
        g.bezierCurveTo(x + s * 0.17, y - s * 0.06, x + s * 0.15, y + s * 0.12, x, y + s * 0.12)
        g.bezierCurveTo(x - s * 0.15, y + s * 0.12, x - s * 0.17, y - s * 0.06, x, y - s * 0.19)
        g.fillStyle = gr
        g.fill()
        g.strokeStyle = 'rgba(255,220,230,0.4)'
        g.lineWidth = 1
        for (const o of [-0.06, 0, 0.06]) {
          g.beginPath()
          g.moveTo(x, y - s * 0.17)
          g.quadraticCurveTo(x + o * s * 1.6, y, x + o * s * 0.6, y + s * 0.11)
          g.stroke()
        }
      })
      break
    case 'potato':
      pile(6, (x, y, i) => {
        ellipse(g, x, y, s * 0.15, s * 0.1, (i % 3) * 0.4 - 0.4, '#c49a5c', '#8a6634')
        for (let k = 0; k < 4; k++) ellipse(g, x + (R() - 0.5) * s * 0.18, y + (R() - 0.5) * s * 0.1, s * 0.008, s * 0.008, 0, '#7a5428')
      })
      break
    case 'carrot':
      for (let i = 0; i < 6; i++) {
        g.save()
        g.translate(cx - s * 0.25 + i * s * 0.1, cy + s * 0.05)
        g.rotate(-0.5 + i * 0.12)
        g.beginPath()
        g.moveTo(-s * 0.05, -s * 0.18)
        g.lineTo(s * 0.05, -s * 0.18)
        g.lineTo(s * 0.006, s * 0.25)
        g.closePath()
        g.fillStyle = i % 2 ? '#ee7a1f' : '#f28a2e'
        g.fill()
        for (let k = 0; k < 3; k++) leafShape(g, 0, -s * 0.18, s * 0.12, -Math.PI / 2 + (k - 1) * 0.4, '#4c9a3a')
        g.restore()
      }
      break
    case 'brinjal':
      pile(5, (x, y, i) => {
        g.save()
        g.translate(x, y)
        g.rotate((i - 2) * 0.25)
        const gr = g.createLinearGradient(-s * 0.1, 0, s * 0.1, 0)
        gr.addColorStop(0, '#8a4ca3')
        gr.addColorStop(1, '#3b1849')
        ellipse(g, 0, s * 0.03, s * 0.09, s * 0.15, 0, gr)
        star(g, 0, -s * 0.11, s * 0.07, '#4c8a2e')
        g.fillStyle = '#4c8a2e'
        g.fillRect(-s * 0.012, -s * 0.2, s * 0.024, s * 0.08)
        g.restore()
      }, 0.9)
      break
    case 'drumstick':
    case 'okra':
    case 'chilli': {
      const n = kind === 'drumstick' ? 9 : 10
      for (let i = 0; i < n; i++) {
        g.save()
        g.translate(cx + (i - n / 2) * s * 0.035, cy + s * 0.05)
        g.rotate(-0.25 + (i / n) * 0.5 + (R() - 0.5) * 0.15)
        const len = kind === 'drumstick' ? s * 0.62 : kind === 'okra' ? s * 0.3 : s * 0.26
        const wd = kind === 'drumstick' ? s * 0.022 : kind === 'okra' ? s * 0.045 : s * 0.02
        g.beginPath()
        g.moveTo(-wd, -len / 2)
        g.lineTo(wd, -len / 2)
        g.lineTo(kind === 'drumstick' ? wd * 0.8 : wd * 0.2, len / 2)
        g.lineTo(kind === 'drumstick' ? -wd * 0.8 : -wd * 0.2, len / 2)
        g.closePath()
        g.fillStyle = i % 2 ? '#5f8f2f' : '#76a83c'
        g.fill()
        g.strokeStyle = 'rgba(255,255,255,0.25)'
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(0, -len / 2)
        g.lineTo(0, len / 2)
        g.stroke()
        g.restore()
      }
      break
    }
    case 'lemon':
      pile(6, (x, y) => {
        const gr = g.createRadialGradient(x - s * 0.03, y - s * 0.03, 1, x, y, s * 0.12)
        gr.addColorStop(0, '#fff07a')
        gr.addColorStop(1, '#d6ae12')
        ellipse(g, x, y, s * 0.12, s * 0.095, 0, gr)
        ellipse(g, x + s * 0.12, y, s * 0.02, s * 0.015, 0, '#c99d10')
      })
      break
    case 'leaves':
      for (let i = 0; i < 26; i++) {
        const a = -Math.PI / 2 + (R() - 0.5) * 2.2
        leafShape(g, cx + (R() - 0.5) * s * 0.1, cy + s * 0.12, s * (0.22 + R() * 0.15), a, i % 3 ? '#3f8a36' : '#5aa848')
      }
      g.fillStyle = '#c9a26a'
      g.fillRect(cx - s * 0.06, cy + s * 0.1, s * 0.12, s * 0.04)
      break
    case 'garlic':
      pile(5, (x, y) => {
        g.beginPath()
        g.moveTo(x, y - s * 0.16)
        g.bezierCurveTo(x + s * 0.16, y - s * 0.05, x + s * 0.15, y + s * 0.1, x, y + s * 0.1)
        g.bezierCurveTo(x - s * 0.15, y + s * 0.1, x - s * 0.16, y - s * 0.05, x, y - s * 0.16)
        g.fillStyle = '#f1ebe0'
        g.fill()
        g.strokeStyle = 'rgba(150,110,160,0.5)'
        g.lineWidth = 1
        g.stroke()
        for (const o of [-0.05, 0.05]) {
          g.beginPath()
          g.moveTo(x, y - s * 0.14)
          g.quadraticCurveTo(x + o * s * 1.5, y, x + o * s, y + s * 0.09)
          g.stroke()
        }
      })
      break
    case 'coconut':
      pile(4, (x, y) => {
        const gr = g.createRadialGradient(x - s * 0.06, y - s * 0.06, 1, x, y, s * 0.2)
        gr.addColorStop(0, '#9a6a42')
        gr.addColorStop(1, '#4a2e18')
        ellipse(g, x, y, s * 0.18, s * 0.16, 0, gr)
        g.strokeStyle = 'rgba(40,25,10,0.4)'
        for (let k = 0; k < 8; k++) {
          g.beginPath()
          const a = R() * Math.PI * 2
          g.moveTo(x + Math.cos(a) * s * 0.05, y + Math.sin(a) * s * 0.05)
          g.lineTo(x + Math.cos(a) * s * 0.16, y + Math.sin(a) * s * 0.14)
          g.stroke()
        }
      }, 1.4)
      break
    case 'banana':
      for (let i = 0; i < 6; i++) {
        g.save()
        g.translate(cx - s * 0.05, cy - s * 0.12)
        g.rotate(-0.9 + i * 0.32)
        g.beginPath()
        g.moveTo(0, 0)
        g.quadraticCurveTo(s * 0.18, s * 0.05, s * 0.36, -s * 0.06)
        g.quadraticCurveTo(s * 0.2, s * 0.13, 0, s * 0.06)
        g.closePath()
        const gr = g.createLinearGradient(0, 0, 0, s * 0.1)
        gr.addColorStop(0, '#f8de5a')
        gr.addColorStop(1, '#cfa214')
        g.fillStyle = gr
        g.fill()
        g.fillStyle = '#4a3a1a'
        ellipse(g, s * 0.355, -s * 0.06, s * 0.012, s * 0.012, 0, '#4a3a1a')
        g.restore()
      }
      g.fillStyle = '#6b8a2a'
      g.fillRect(cx - s * 0.08, cy - s * 0.16, s * 0.05, s * 0.08)
      break
    case 'papaya': {
      const gr = g.createLinearGradient(cx - s * 0.3, 0, cx + s * 0.3, 0)
      gr.addColorStop(0, '#7aa33a')
      gr.addColorStop(0.6, '#f0a33a')
      gr.addColorStop(1, '#e87a1a')
      ellipse(g, cx - s * 0.08, cy, s * 0.3, s * 0.17, -0.15, gr)
      ellipse(g, cx + s * 0.2, cy + s * 0.1, s * 0.16, s * 0.1, 0.2, '#f07a2a')
      ellipse(g, cx + s * 0.2, cy + s * 0.1, s * 0.12, s * 0.06, 0.2, '#ff9a4a')
      for (let k = 0; k < 9; k++) ellipse(g, cx + s * (0.14 + R() * 0.12), cy + s * (0.08 + R() * 0.04), s * 0.012, s * 0.012, 0, '#2a1a10')
      break
    }
    case 'ginger':
      pile(5, (x, y, i) => {
        g.save()
        g.translate(x, y)
        g.rotate(i * 0.7)
        ellipse(g, 0, 0, s * 0.11, s * 0.06, 0, '#c9a36b', '#8f6b38')
        ellipse(g, s * 0.08, -s * 0.05, s * 0.05, s * 0.04, 0.6, '#d1ad76', '#8f6b38')
        g.restore()
      })
      break
    default:
      pile(6, (x, y, i) => tomato(g, x, y, s * 0.12, ['#d9302c', '#ee7a1f', '#7fae3f'][i % 3]))
  }
}

/** A woven basket the loose produce sits in. */
function basket(g: G, cx: number, cy: number, w: number, h: number) {
  g.beginPath()
  g.moveTo(cx - w / 2, cy)
  g.lineTo(cx + w / 2, cy)
  g.lineTo(cx + w * 0.42, cy + h)
  g.lineTo(cx - w * 0.42, cy + h)
  g.closePath()
  const gr = g.createLinearGradient(0, cy, 0, cy + h)
  gr.addColorStop(0, '#c99a5c')
  gr.addColorStop(1, '#8a6232')
  g.fillStyle = gr
  g.fill()
  g.strokeStyle = 'rgba(80,50,20,0.45)'
  g.lineWidth = 1.2
  for (let yy = cy + h * 0.25; yy < cy + h; yy += h * 0.25) {
    g.beginPath()
    g.moveTo(cx - w / 2, yy)
    g.lineTo(cx + w / 2, yy)
    g.stroke()
  }
  for (let xx = -w / 2; xx <= w / 2; xx += w / 9) {
    g.beginPath()
    g.moveTo(cx + xx, cy)
    g.lineTo(cx + xx * 0.84, cy + h)
    g.stroke()
  }
  rr(g, cx - w / 2 - 2, cy - 3, w + 4, 6, 3)
  g.fillStyle = '#a77a42'
  g.fill()
}

/** Draw a whole pack centred in an S×S canvas. */
export function drawPack(g: G, p: PackSource, S: number) {
  const d = designFor(p)
  const cx = S / 2
  const floor = S * 0.92
  const k = d.kind

  if (k === 'produce') {
    shadowAt(g, cx, floor, S * 0.36)
    basket(g, cx, S * 0.58, S * 0.7, S * 0.3)
    g.save()
    g.beginPath()
    g.rect(0, 0, S, S * 0.6)
    g.clip()
    drawProduce(g, d.produce ?? 'mixed', cx, S * 0.42, S, d.seed)
    g.restore()
    return
  }

  switch (k) {
    case 'sack': {
      const w = S * 0.66
      const h = S * 0.8
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.62)
      const path = () => {
        g.beginPath()
        g.moveTo(x + w * 0.04, y)
        g.lineTo(x + w * 0.96, y)
        g.quadraticCurveTo(x + w * 1.04, y + h * 0.5, x + w, y + h * 0.96)
        g.quadraticCurveTo(cx, y + h * 1.02, x, y + h * 0.96)
        g.quadraticCurveTo(x - w * 0.04, y + h * 0.5, x + w * 0.04, y)
        g.closePath()
      }
      printed(g, path, p, d, [x - 6, y, w + 12, h], [x + w * 0.06, y + h * 0.13, w * 0.88, h * 0.8])
      g.fillStyle = shade(d.base2, -0.1)
      g.fillRect(x + w * 0.04, y, w * 0.92, h * 0.07)
      g.strokeStyle = 'rgba(255,255,255,0.7)'
      g.setLineDash([4, 3])
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(x + w * 0.06, y + h * 0.035)
      g.lineTo(x + w * 0.94, y + h * 0.035)
      g.stroke()
      g.setLineDash([])
      rr(g, cx - w * 0.12, y + h * 0.085, w * 0.24, h * 0.035, h * 0.02)
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.fill()
      break
    }
    case 'pillow': {
      const w = S * 0.62
      const h = S * 0.78
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.6)
      const sh = h * 0.07
      const path = () => {
        g.beginPath()
        g.moveTo(x, y + sh)
        g.lineTo(x + w, y + sh)
        g.bezierCurveTo(x + w * 1.05, y + h * 0.35, x + w * 1.05, y + h * 0.65, x + w, y + h - sh)
        g.lineTo(x, y + h - sh)
        g.bezierCurveTo(x - w * 0.05, y + h * 0.65, x - w * 0.05, y + h * 0.35, x, y + sh)
        g.closePath()
      }
      printed(g, path, p, d, [x - w * 0.05, y, w * 1.1, h], [x + w * 0.02, y + sh, w * 0.96, h - sh * 2])
      serration(g, x, y + 2, w, sh - 2, shade(d.base2, -0.05), false)
      serration(g, x, y + h - sh, w, sh - 2, shade(d.base2, -0.05), true)
      break
    }
    case 'standup': {
      const w = S * 0.58
      const h = S * 0.8
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.62)
      const path = () => {
        g.beginPath()
        g.moveTo(x + w * 0.03, y)
        g.lineTo(x + w * 0.97, y)
        g.lineTo(x + w * 1.02, y + h * 0.9)
        g.quadraticCurveTo(cx, y + h * 1.04, x - w * 0.02, y + h * 0.9)
        g.closePath()
      }
      printed(g, path, p, d, [x - w * 0.05, y, w * 1.1, h], [x + w * 0.02, y + h * 0.1, w * 0.96, h * 0.82])
      g.fillStyle = shade(d.base2, -0.08)
      g.fillRect(x + w * 0.03, y, w * 0.94, h * 0.06)
      g.strokeStyle = 'rgba(0,0,0,0.25)'
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(x + w * 0.04, y + h * 0.085)
      g.lineTo(x + w * 0.96, y + h * 0.085)
      g.stroke()
      break
    }
    case 'box':
    case 'tallbox':
    case 'widebox': {
      const w = k === 'widebox' ? S * 0.74 : k === 'tallbox' ? S * 0.42 : S * 0.54
      const h = k === 'widebox' ? S * 0.44 : k === 'tallbox' ? S * 0.76 : S * 0.7
      const dep = S * 0.09
      const x = cx - w / 2 - dep / 3
      const y = floor - h
      shadowAt(g, cx + dep / 2, floor, (w + dep) * 0.6)
      // side
      g.beginPath()
      g.moveTo(x + w, y)
      g.lineTo(x + w + dep, y - dep * 0.55)
      g.lineTo(x + w + dep, y + h - dep * 0.55)
      g.lineTo(x + w, y + h)
      g.closePath()
      g.fillStyle = shade(d.base2, -0.18)
      g.fill()
      g.fillStyle = alpha(d.accent, 0.6)
      g.fillRect(x + w + 1, y + h * 0.05, dep - 2, h * 0.12)
      // top
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + dep, y - dep * 0.55)
      g.lineTo(x + w + dep, y - dep * 0.55)
      g.lineTo(x + w, y)
      g.closePath()
      g.fillStyle = shade(d.base, 0.25)
      g.fill()
      const path = () => {
        g.beginPath()
        g.rect(x, y, w, h)
      }
      printed(g, path, p, d, [x, y, w, h], [x, y, w, h], 0.7)
      break
    }
    case 'bottle-oil':
    case 'bottle-pet': {
      const w = S * (k === 'bottle-pet' ? 0.3 : 0.36)
      const h = S * 0.86
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.7)
      const neck = w * 0.34
      const path = () => {
        g.beginPath()
        g.moveTo(cx - neck / 2, y + h * 0.07)
        g.lineTo(cx + neck / 2, y + h * 0.07)
        g.lineTo(cx + neck / 2, y + h * 0.12)
        g.bezierCurveTo(cx + w * 0.5, y + h * 0.18, x + w, y + h * 0.22, x + w, y + h * 0.3)
        g.lineTo(x + w, y + h * 0.5)
        g.quadraticCurveTo(x + w * 0.9, y + h * 0.56, x + w, y + h * 0.62)
        g.lineTo(x + w, y + h * 0.96)
        g.quadraticCurveTo(x + w, y + h, x + w * 0.9, y + h)
        g.lineTo(x + w * 0.1, y + h)
        g.quadraticCurveTo(x, y + h, x, y + h * 0.96)
        g.lineTo(x, y + h * 0.62)
        g.quadraticCurveTo(x + w * 0.1, y + h * 0.56, x, y + h * 0.5)
        g.lineTo(x, y + h * 0.3)
        g.bezierCurveTo(x, y + h * 0.22, cx - w * 0.5, y + h * 0.18, cx - neck / 2, y + h * 0.12)
        g.closePath()
      }
      g.save()
      path()
      g.clip()
      const liquid = g.createLinearGradient(x, 0, x + w, 0)
      liquid.addColorStop(0, shade(d.base, -0.2))
      liquid.addColorStop(0.3, shade(d.base, 0.35))
      liquid.addColorStop(1, shade(d.base2, -0.15))
      g.fillStyle = liquid
      g.fillRect(x - 4, y, w + 8, h)
      if (k === 'bottle-pet') {
        g.strokeStyle = 'rgba(255,255,255,0.55)'
        g.lineWidth = 1.5
        for (let yy = y + h * 0.3; yy < y + h * 0.95; yy += h * 0.05) {
          g.beginPath()
          g.moveTo(x, yy)
          g.lineTo(x + w, yy)
          g.stroke()
        }
      }
      const labelTop = y + h * (k === 'bottle-pet' ? 0.38 : 0.36)
      const labelH = h * (k === 'bottle-pet' ? 0.3 : 0.4)
      paintFace(g, p, d, x, labelTop, w, labelH, { tamil: false })
      if (k === 'bottle-oil') {
        g.fillStyle = d.accent
        g.fillRect(x, labelTop - 3, w, 3)
        g.fillRect(x, labelTop + labelH, w, 3)
      }
      volume(g, x, w, y, h, 1.1)
      ellipse(g, x + w * 0.22, y + h * 0.28, w * 0.04, h * 0.05, 0, 'rgba(255,255,255,0.7)')
      g.restore()
      path()
      g.strokeStyle = 'rgba(0,0,0,0.2)'
      g.lineWidth = 1.2
      g.stroke()
      cap(g, cx, y, neck * 1.25, h * 0.075, k === 'bottle-pet' ? d.accent : d.accent)
      break
    }
    case 'bottle-flip':
    case 'bottle-spray': {
      const w = S * 0.4
      const h = S * (k === 'bottle-spray' ? 0.64 : 0.74)
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.7)
      const path = () => {
        g.beginPath()
        g.moveTo(cx - w * 0.22, y)
        g.lineTo(cx + w * 0.22, y)
        g.quadraticCurveTo(x + w, y + h * 0.02, x + w, y + h * 0.16)
        g.lineTo(x + w, y + h * 0.94)
        g.quadraticCurveTo(x + w, y + h, x + w * 0.88, y + h)
        g.lineTo(x + w * 0.12, y + h)
        g.quadraticCurveTo(x, y + h, x, y + h * 0.94)
        g.lineTo(x, y + h * 0.16)
        g.quadraticCurveTo(x, y + h * 0.02, cx - w * 0.22, y)
        g.closePath()
      }
      printed(g, path, p, d, [x, y, w, h], [x + w * 0.04, y + h * 0.2, w * 0.92, h * 0.74])
      if (k === 'bottle-flip') {
        cap(g, cx, y - S * 0.06, w * 0.5, S * 0.065, d.accent === '#ffffff' ? '#f2f2f2' : d.accent)
      } else {
        g.fillStyle = '#f4f4f4'
        rr(g, cx - w * 0.2, y - S * 0.1, w * 0.4, S * 0.1, 3)
        g.fill()
        g.beginPath()
        g.moveTo(cx + w * 0.2, y - S * 0.1)
        g.lineTo(cx + w * 0.62, y - S * 0.09)
        g.lineTo(cx + w * 0.62, y - S * 0.05)
        g.lineTo(cx + w * 0.2, y - S * 0.04)
        g.fill()
        g.fillStyle = shade(d.base, -0.3)
        rr(g, cx + w * 0.02, y - S * 0.04, w * 0.14, S * 0.09, 3)
        g.fill()
      }
      break
    }
    case 'jar': {
      const w = S * 0.56
      const h = S * 0.6
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.62)
      const path = () => rr(g, x, y + h * 0.12, w, h * 0.88, w * 0.12)
      printed(g, path, p, d, [x, y, w, h], [x, y + h * 0.3, w, h * 0.58], 1)
      cap(g, cx, y, w * 0.9, h * 0.16, d.accent === '#ffffff' ? '#e9e9e9' : d.accent)
      break
    }
    case 'tub': {
      const w = S * 0.62
      const h = S * 0.48
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.56)
      const path = () => {
        g.beginPath()
        g.moveTo(x, y + h * 0.16)
        g.lineTo(x + w, y + h * 0.16)
        g.lineTo(x + w * 0.9, y + h)
        g.lineTo(x + w * 0.1, y + h)
        g.closePath()
      }
      printed(g, path, p, d, [x, y, w, h], [x + w * 0.04, y + h * 0.2, w * 0.92, h * 0.78])
      rr(g, x - w * 0.03, y, w * 1.06, h * 0.17, 5)
      g.fillStyle = d.accent
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.3)'
      g.fillRect(x, y + h * 0.03, w, h * 0.04)
      break
    }
    case 'carton':
    case 'gable': {
      const w = S * 0.42
      const h = S * (k === 'gable' ? 0.66 : 0.72)
      const dep = S * 0.08
      const x = cx - w / 2 - dep / 3
      const y = floor - h
      shadowAt(g, cx + dep / 2, floor, (w + dep) * 0.62)
      g.beginPath()
      g.moveTo(x + w, y)
      g.lineTo(x + w + dep, y - dep * 0.5)
      g.lineTo(x + w + dep, y + h - dep * 0.5)
      g.lineTo(x + w, y + h)
      g.closePath()
      g.fillStyle = shade(d.base2, -0.18)
      g.fill()
      if (k === 'gable') {
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(cx - dep / 3, y - S * 0.12)
        g.lineTo(x + w, y)
        g.closePath()
        g.fillStyle = shade(d.base, 0.15)
        g.fill()
        g.fillStyle = shade(d.base, 0.25)
        g.fillRect(cx - dep / 3 - w * 0.3, y - S * 0.15, w * 0.6, S * 0.035)
      } else {
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x + dep, y - dep * 0.5)
        g.lineTo(x + w + dep, y - dep * 0.5)
        g.lineTo(x + w, y)
        g.closePath()
        g.fillStyle = shade(d.base, 0.25)
        g.fill()
        ellipse(g, x + w * 0.75, y - dep * 0.25, w * 0.09, dep * 0.18, 0, d.accent)
      }
      printed(g, () => {
        g.beginPath()
        g.rect(x, y, w, h)
      }, p, d, [x, y, w, h], [x, y, w, h], 0.7)
      break
    }
    case 'milkpouch': {
      const w = S * 0.66
      const h = S * 0.56
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.58)
      const path = () => {
        g.beginPath()
        g.moveTo(x + w * 0.06, y + h * 0.06)
        g.lineTo(x + w * 0.94, y + h * 0.06)
        g.bezierCurveTo(x + w * 1.03, y + h * 0.3, x + w * 1.03, y + h * 0.7, x + w * 0.94, y + h * 0.94)
        g.lineTo(x + w * 0.06, y + h * 0.94)
        g.bezierCurveTo(x - w * 0.03, y + h * 0.7, x - w * 0.03, y + h * 0.3, x + w * 0.06, y + h * 0.06)
        g.closePath()
      }
      printed(g, path, p, d, [x, y, w, h], [x + w * 0.04, y + h * 0.08, w * 0.92, h * 0.84])
      serration(g, x + w * 0.06, y, w * 0.88, h * 0.07, shade(d.base2, -0.05), false)
      serration(g, x + w * 0.06, y + h * 0.93, w * 0.88, h * 0.07, shade(d.base2, -0.05), true)
      break
    }
    case 'can': {
      const w = S * 0.4
      const h = S * 0.62
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.68)
      printed(g, () => rr(g, x, y + h * 0.05, w, h * 0.9, 6), p, d, [x, y, w, h], [x, y + h * 0.12, w, h * 0.76], 1.2)
      for (const yy of [y + h * 0.05, y + h * 0.95]) {
        const gr = g.createLinearGradient(x, 0, x + w, 0)
        gr.addColorStop(0, '#8d9198')
        gr.addColorStop(0.35, '#eef0f2')
        gr.addColorStop(1, '#7c8087')
        ellipse(g, cx, yy, w / 2, h * 0.045, 0, gr)
      }
      break
    }
    case 'bar': {
      const w = S * 0.76
      const h = S * 0.38
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.56)
      printed(g, () => rr(g, x, y, w, h, h * 0.12), p, d, [x, y, w, h], [x + w * 0.06, y, w * 0.88, h], 0.8)
      g.fillStyle = 'rgba(0,0,0,0.12)'
      for (const sx of [x, x + w - w * 0.06]) {
        g.beginPath()
        g.moveTo(sx, y + h * 0.1)
        g.lineTo(sx + w * 0.06 * (sx === x ? 1 : 0), y + h * 0.5)
        g.lineTo(sx, y + h * 0.9)
        g.fill()
      }
      break
    }
    case 'loaf': {
      const w = S * 0.74
      const h = S * 0.5
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.56)
      // the loaf: one domed top, crust darker where it browned
      g.beginPath()
      g.moveTo(x + w * 0.06, y + h)
      g.lineTo(x + w * 0.06, y + h * 0.42)
      g.bezierCurveTo(x + w * 0.06, y - h * 0.08, x + w * 0.94, y - h * 0.08, x + w * 0.94, y + h * 0.42)
      g.lineTo(x + w * 0.94, y + h)
      g.closePath()
      const crust = g.createLinearGradient(0, y, 0, y + h)
      crust.addColorStop(0, shade(d.base, -0.18))
      crust.addColorStop(0.45, d.base)
      crust.addColorStop(1, shade(d.base, 0.3))
      g.fillStyle = crust
      g.fill()
      g.strokeStyle = alpha(shade(d.base, -0.45), 0.35)
      g.lineWidth = 1.2
      for (let i = 1; i < 7; i++) {
        const sx = x + w * 0.06 + (i * w * 0.88) / 7
        g.beginPath()
        g.moveTo(sx, y + h * 0.18)
        g.lineTo(sx, y + h * 0.98)
        g.stroke()
      }
      ellipse(g, x + w * 0.35, y + h * 0.12, w * 0.18, h * 0.05, -0.08, 'rgba(255,240,210,0.35)')
      // bag sheen, gathered and twisted at the end
      rr(g, x, y - h * 0.08, w, h * 1.08, h * 0.22)
      g.fillStyle = 'rgba(255,255,255,0.16)'
      g.fill()
      g.strokeStyle = 'rgba(255,255,255,0.6)'
      g.lineWidth = 1.5
      g.stroke()
      // paper label band
      const lb = [x + w * 0.22, y + h * 0.42, w * 0.56, h * 0.48] as const
      g.save()
      rr(g, ...lb, 4)
      g.clip()
      paintFace(g, p, { ...d, base: '#fffdf6', base2: '#f1e9d8', ink: '#1b1d1a', pattern: 'none' }, ...lb, { tamil: false })
      g.restore()
      // twist tie
      g.fillStyle = d.accent
      g.fillRect(x - S * 0.03, y + h * 0.4, S * 0.06, S * 0.025)
      break
    }
    case 'cake': {
      const w = S * 0.66
      const h = S * 0.5
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.6)
      printed(g, () => rr(g, x, y, w, h, 6), p, { ...d, base: d.panel, base2: shade(d.panel, -0.08), ink: '#1b1d1a', pattern: 'dots' }, [x, y, w, h], [x, y, w, h], 0.6)
      // window showing the cake
      rr(g, x + w * 0.08, y + h * 0.36, w * 0.44, h * 0.42, 6)
      g.fillStyle = shade(d.base, 0.05)
      g.fill()
      g.fillStyle = '#fff2d8'
      g.fillRect(x + w * 0.08, y + h * 0.5, w * 0.44, h * 0.05)
      g.fillStyle = 'rgba(255,255,255,0.25)'
      g.fillRect(x + w * 0.1, y + h * 0.38, w * 0.08, h * 0.38)
      break
    }
    case 'pastry': {
      const w = S * 0.7
      shadowAt(g, cx, floor, w * 0.56)
      ellipse(g, cx, floor - S * 0.06, w * 0.5, S * 0.09, 0, '#ffffff', 'rgba(0,0,0,0.08)')
      if (/roll/i.test(p.name.en)) {
        const gr = g.createLinearGradient(0, floor - S * 0.4, 0, floor - S * 0.1)
        gr.addColorStop(0, '#f6d9a8')
        gr.addColorStop(1, '#c9944f')
        rr(g, cx - w * 0.38, floor - S * 0.38, w * 0.76, S * 0.26, S * 0.13)
        g.fillStyle = gr
        g.fill()
        ellipse(g, cx - w * 0.36, floor - S * 0.25, S * 0.07, S * 0.12, 0, '#fffaf0', '#e8d6b0')
        g.strokeStyle = 'rgba(140,90,40,0.5)'
        g.lineWidth = 2
        for (let i = 0; i < 5; i++) {
          g.beginPath()
          g.moveTo(cx - w * 0.25 + i * w * 0.12, floor - S * 0.37)
          g.lineTo(cx - w * 0.2 + i * w * 0.12, floor - S * 0.13)
          g.stroke()
        }
      } else {
        g.beginPath()
        g.moveTo(cx - w * 0.42, floor - S * 0.1)
        g.lineTo(cx + w * 0.42, floor - S * 0.1)
        g.lineTo(cx + w * 0.1, floor - S * 0.46)
        g.closePath()
        const gr = g.createLinearGradient(0, floor - S * 0.46, 0, floor - S * 0.1)
        gr.addColorStop(0, '#f2bf5c')
        gr.addColorStop(1, '#b8761c')
        g.fillStyle = gr
        g.fill()
        g.strokeStyle = 'rgba(255,240,200,0.6)'
        g.lineWidth = 1.5
        for (let i = 1; i < 5; i++) {
          g.beginPath()
          g.moveTo(cx - w * 0.42 + i * 0.07 * w, floor - S * 0.1 - i * S * 0.065)
          g.lineTo(cx + w * 0.42 - i * 0.05 * w, floor - S * 0.1 - i * S * 0.065)
          g.stroke()
        }
      }
      break
    }
    case 'eggs': {
      const w = S * 0.76
      const h = S * 0.44
      const x = cx - w / 2
      const y = floor - h
      shadowAt(g, cx, floor, w * 0.56)
      rr(g, x, y + h * 0.35, w, h * 0.65, 6)
      g.fillStyle = '#c8bca8'
      g.fill()
      for (let i = 0; i < 6; i++) {
        const ex = x + w * (0.12 + (i % 3) * 0.38)
        const ey = y + h * (i < 3 ? 0.38 : 0.28)
        const c = i % 2 ? '#e8c49a' : '#f3e6d0'
        ellipse(g, ex + (i < 3 ? 0 : w * 0.19) - w * 0.04, ey, w * 0.1, h * 0.26, 0, c, 'rgba(120,90,50,0.35)')
      }
      const lb = [x, y + h * 0.55, w, h * 0.45] as const
      g.save()
      rr(g, ...lb, 4)
      g.clip()
      paintFace(g, p, { ...d, base: d.accent, base2: shade(d.accent, -0.2), ink: '#ffffff', accent: '#f6c445', accentInk: '#1b1d1a', pattern: 'none' }, ...lb, { tamil: false })
      g.restore()
      break
    }
  }
}

/* ------------------------------------------------------------------ cache */

const urlCache = new Map<string, string>()

/** A whole-pack picture as an image URL, cached per product, size and font state. */
export function packImageUrl(p: PackSource, size = 320): string {
  const key = `${p.id}|${size}|${fontsReady ? 1 : 0}`
  const hit = urlCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  c.width = c.height = Math.round(size * dpr)
  const g = c.getContext('2d')
  if (!g) return ''
  g.scale(dpr, dpr)
  drawPack(g, p, size)
  let url = c.toDataURL('image/webp', 0.9)
  if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/png')
  urlCache.set(key, url)
  return url
}
