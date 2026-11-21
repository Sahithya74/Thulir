import { CanvasTexture, SRGBColorSpace } from 'three'
import { formatPaise, type Localised, type ProductView } from '@thulir/shared'
import { drawPack, paintFace } from '@/components/products/packArt'
import { designFor, shade, type PackDesign } from '@/components/products/packDesign'

/**
 * Canvas textures for the 3D shelf, drawn with the same painter as the product cards so a pack looks the same in
 * both views. Cached per product and disposed in bulk when the shelf scene unmounts (see disposePackTextures).
 */
const cache = new Map<string, CanvasTexture>()

function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): CanvasTexture {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = Math.round(w)
  c.height = Math.round(h)
  const g = c.getContext('2d')!
  draw(g)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  cache.set(key, t)
  return t
}

/** Crimped seal across a pouch end. */
function seal(g: CanvasRenderingContext2D, d: PackDesign, y: number, w: number, h: number) {
  g.fillStyle = shade(d.base2, -0.06)
  g.fillRect(0, y, w, h)
  g.strokeStyle = 'rgba(0,0,0,0.14)'
  g.lineWidth = 1.5
  for (let x = 3; x < w; x += 5) {
    g.beginPath()
    g.moveTo(x, y + 2)
    g.lineTo(x, y + h - 2)
    g.stroke()
  }
}

/** The printed front of a box / pouch, at the face's aspect ratio (width / height). */
export function faceTexture(p: ProductView, aspect: number, sealed = false): CanvasTexture {
  const W = aspect >= 1 ? 384 : Math.round(384 * aspect)
  const H = aspect >= 1 ? Math.round(384 / aspect) : 384
  return make(`face|${p.id}|${aspect.toFixed(2)}|${sealed}`, W, H, (g) => {
    const d = designFor(p)
    if (!sealed) return paintFace(g, p, d, 0, 0, W, H)
    const s = H * 0.07
    paintFace(g, p, d, 0, s, W, H - s * 2)
    seal(g, d, 0, W, s)
    seal(g, d, H - s, W, s)
  })
}

/**
 * A label that wraps round a bottle, jar, tub or can. `ratio` is circumference ÷ label height, so the print is not
 * stretched. The front art takes the third of the strip that the cylinder turns towards the shopper; the back
 * carries a plain panel and a barcode.
 */
export function wrapTexture(p: ProductView, ratio: number): CanvasTexture {
  const H = 256
  const W = Math.max(384, Math.min(2048, Math.round(H * ratio)))
  return make(`wrap|${p.id}|${W}`, W, H, (g) => {
    const d = designFor(p)
    const bg = g.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, shade(d.base, 0.1))
    bg.addColorStop(1, d.base2)
    g.fillStyle = bg
    g.fillRect(0, 0, W, H)
    const fw = W / 3
    paintFace(g, p, d, W / 2 - fw / 2, 0, fw, H, { tamil: fw > 180 })
    g.fillStyle = '#ffffff'
    g.fillRect(W * 0.06, H * 0.55, Math.min(120, W * 0.12), H * 0.32)
    g.fillStyle = '#111'
    const bx = W * 0.06
    for (let x = 6; x < Math.min(112, W * 0.12 - 6); x += 3 + ((x * 7) % 4)) g.fillRect(bx + x, H * 0.58, (x * 13) % 3 === 0 ? 3 : 1.5, H * 0.22)
    g.fillStyle = d.accent
    g.fillRect(0, 0, W, 6)
    g.fillRect(0, H - 6, W, 6)
  })
}

/** The whole-pack picture with a transparent background, for packs shown as a standee (cakes, loaves, eggs). */
export function standeeTexture(p: ProductView): CanvasTexture {
  return make(`standee|${p.id}`, 384, 384, (g) => drawPack(g, p, 384))
}

/** Shelf-edge price ticket, the way real stores print them. */
export function priceTagTexture(p: ProductView, soldOut: boolean): CanvasTexture {
  return make(`tag|${p.id}|${soldOut}|${p.pricePaise}|${p.mrpPaise}`, 384, 128, (g) => {
    const W = 384
    const H = 128
    g.fillStyle = soldOut ? '#f3e4c8' : p.discountPercent > 0 ? '#ffe36b' : '#ffffff'
    g.fillRect(0, 0, W, H)
    g.fillStyle = soldOut ? '#9aa09a' : p.discountPercent > 0 ? '#c4282c' : '#2b1a12'
    g.fillRect(0, 0, W, 10)
    g.fillStyle = '#2b1a12'
    g.textBaseline = 'alphabetic'
    g.textAlign = 'left'
    g.font = '800 54px "Inter Variable", Inter, system-ui, sans-serif'
    g.fillText(soldOut ? 'Sold out' : formatPaise(p.pricePaise), 16, 74)
    if (!soldOut && p.mrpPaise > p.pricePaise) {
      const x = 22 + g.measureText(formatPaise(p.pricePaise)).width
      g.font = '600 26px "Inter Variable", Inter, system-ui, sans-serif'
      g.fillStyle = '#6b6f6a'
      const mrp = `MRP ${formatPaise(p.mrpPaise)}`
      g.fillText(mrp, x, 72)
      g.fillRect(x, 63, g.measureText(mrp).width, 2.5)
    }
    g.fillStyle = '#3a3f3b'
    g.font = '600 24px "Inter Variable", Inter, system-ui, sans-serif'
    const line = `${p.name.en} · ${p.unit}`
    let s = line
    while (g.measureText(s).width > W - 30 && s.length > 4) s = `${s.slice(0, -2)}…`
    g.fillText(s, 16, 112)
    if (p.discountPercent > 0 && !soldOut) {
      g.fillStyle = '#c4282c'
      g.beginPath()
      g.arc(W - 46, 46, 34, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#fff'
      g.textAlign = 'center'
      g.font = '800 22px "Inter Variable", Inter, system-ui, sans-serif'
      g.fillText(`${p.discountPercent}%`, W - 46, 46)
      g.font = '700 14px "Inter Variable", Inter, system-ui, sans-serif'
      g.fillText('OFF', W - 46, 64)
    }
  })
}

/** Round "Save" wobbler that sticks out from the shelf edge on offer items. */
export function wobblerTexture(pct: number): CanvasTexture {
  return make(`wobbler|${pct}`, 192, 192, (g) => {
    g.fillStyle = '#c4282c'
    g.beginPath()
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      const r = i % 2 ? 84 : 94
      g.lineTo(96 + Math.cos(a) * r, 96 + Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
    g.fillStyle = '#ffe36b'
    g.beginPath()
    g.arc(96, 96, 70, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#c4282c'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '800 26px "Inter Variable", Inter, system-ui, sans-serif'
    g.fillText('SAVE', 96, 70)
    g.font = '900 52px "Inter Variable", Inter, system-ui, sans-serif'
    g.fillText(`${pct}%`, 96, 116)
  })
}

/** Hanging department board, in English and Tamil. */
export function signTexture(label: Localised, bg: string, fg: string): CanvasTexture {
  return make(`sign|${label.en}|${bg}`, 768, 192, (g) => {
    g.fillStyle = bg
    g.fillRect(0, 0, 768, 192)
    g.strokeStyle = fg
    g.globalAlpha = 0.5
    g.lineWidth = 4
    g.strokeRect(12, 12, 744, 168)
    g.globalAlpha = 1
    g.fillStyle = fg
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    // shrink long names (two departments on one board) until they fit between the borders
    const fit = (text: string, px: number, face: string, weight: string) => {
      let size = px
      g.font = `${weight} ${size}px ${face}`
      while (size > 22 && g.measureText(text).width > 700) {
        size -= 3
        g.font = `${weight} ${size}px ${face}`
      }
    }
    fit(label.en.toUpperCase(), 74, '"Inter Variable", Inter, system-ui, sans-serif', '800')
    g.fillText(label.en.toUpperCase(), 384, 82)
    fit(label.ta, 40, '"Noto Sans Tamil", sans-serif', '600')
    g.fillText(label.ta, 384, 148)
  })
}

/** Floor finishes per store type. */
export function floorTexture(kind: 'tile' | 'wood' | 'terracotta' | 'checker' | 'white' | 'speckle', a: string, b: string): CanvasTexture {
  return make(`floor|${kind}|${a}|${b}`, 256, 256, (g) => {
    g.fillStyle = a
    g.fillRect(0, 0, 256, 256)
    if (kind === 'wood') {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? b : shade(a, -0.05)
        g.fillRect(0, i * 32, 256, 31)
        g.fillStyle = 'rgba(0,0,0,0.12)'
        g.fillRect(((i * 97) % 200) + 20, i * 32, 2, 31)
      }
    } else if (kind === 'checker') {
      g.fillStyle = b
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 64, y * 64, 64, 64)
    } else if (kind === 'speckle') {
      for (let i = 0; i < 900; i++) {
        g.fillStyle = i % 3 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.25)'
        g.fillRect((i * 73) % 256, (i * 151) % 256, 2, 2)
      }
    }
    if (kind !== 'wood') {
      g.strokeStyle = kind === 'terracotta' ? 'rgba(90,40,20,0.35)' : 'rgba(0,0,0,0.1)'
      g.lineWidth = 2
      const step = kind === 'checker' ? 64 : 128
      for (let x = 0; x <= 256; x += step) {
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x, 256)
        g.stroke()
        g.beginPath()
        g.moveTo(0, x)
        g.lineTo(256, x)
        g.stroke()
      }
    }
  })
}

/** Soft round shadow used under every pack. */
export function blobTexture(): CanvasTexture {
  return make('blob', 128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    gr.addColorStop(0, 'rgba(0,0,0,0.55)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 128, 128)
  })
}

export function disposePackTextures() {
  cache.forEach((t) => t.dispose())
  cache.clear()
}
