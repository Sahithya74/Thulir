import type { Department, PackShape, Product } from '@thulir/shared'

/**
 * Retail-pack design for a product: what kind of pack it is in a real Indian store, its colours, and the small
 * illustration printed on it. Pure data, shared by the 2D picture (packArt.ts) and the 3D shelf (scenes/stores).
 *
 * The designs are generic category packaging — they do not copy any brand's logo or artwork. The brand name is
 * printed in plain type.
 */

export type ArtKind =
  | 'sack'
  | 'pillow'
  | 'standup'
  | 'box'
  | 'tallbox'
  | 'widebox'
  | 'bottle-oil'
  | 'bottle-pet'
  | 'bottle-flip'
  | 'bottle-spray'
  | 'jar'
  | 'tub'
  | 'carton'
  | 'gable'
  | 'milkpouch'
  | 'can'
  | 'bar'
  | 'loaf'
  | 'cake'
  | 'pastry'
  | 'eggs'
  | 'produce'

export type Motif =
  | 'grain'
  | 'lentil'
  | 'wheat'
  | 'drop'
  | 'bean'
  | 'leaf'
  | 'chilli'
  | 'sun'
  | 'wave'
  | 'bubbles'
  | 'tooth'
  | 'sparkle'
  | 'cookie'
  | 'chip'
  | 'milk'
  | 'cup'
  | 'fruit'
  | 'salt'
  | 'spice'
  | 'noodle'
  | 'cake'
  | 'bread'
  | 'egg'
  | 'flower'
  | 'coconut'
  | 'pearl'
  | 'none'

export type Produce =
  | 'tomato'
  | 'onion'
  | 'potato'
  | 'carrot'
  | 'brinjal'
  | 'drumstick'
  | 'okra'
  | 'lemon'
  | 'chilli'
  | 'leaves'
  | 'garlic'
  | 'coconut'
  | 'banana'
  | 'apple'
  | 'papaya'
  | 'ginger'
  | 'mixed'

export type Pattern = 'dots' | 'stripes' | 'waves' | 'grid' | 'none'

export interface PackDesign {
  kind: ArtKind
  motif: Motif
  produce?: Produce
  /** Main pack colour (or liquid colour for clear bottles). */
  base: string
  /** Second gradient stop / darker side. */
  base2: string
  /** Brand band, caps, badges. */
  accent: string
  /** Panel behind the illustration. */
  panel: string
  /** Text colour that reads on `base`. */
  ink: string
  /** Text colour that reads on `accent`. */
  accentInk: string
  pattern: Pattern
  /** Stable per-product number for small variations. */
  seed: number
}

export type PackSource = Pick<Product, 'id' | 'name' | 'brand' | 'unit' | 'department' | 'shape' | 'color' | 'veg'> & { tags?: string[] }

type Partial3 = Partial<Omit<PackDesign, 'ink' | 'accentInk' | 'seed'>>

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Lighten (amt > 0) or darken (amt < 0) a colour. */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))))
  return `#${((f(r) << 16) | (f(g) << 8) | f(b)).toString(16).padStart(6, '0')}`
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const c = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/** Dark ink or white, whichever reads better on the background. */
export function inkOn(bg: string): string {
  return contrast(bg, '#1b1d1a') >= contrast(bg, '#ffffff') ? '#1b1d1a' : '#ffffff'
}

const kg = (unit: string) => {
  const m = unit.toLowerCase().match(/([\d.]+)\s*kg/)
  return m ? parseFloat(m[1]) : 0
}

/** Ordered rules: the first whose pattern matches the English name wins. */
const RULES: [RegExp, (p: PackSource) => Partial3][] = [
  // ---------------------------------------------------------------- fresh produce
  [/tomato/, () => ({ kind: 'produce', produce: 'tomato' })],
  [/onion/, () => ({ kind: 'produce', produce: 'onion' })],
  [/potato/, () => ({ kind: 'produce', produce: 'potato' })],
  [/carrot/, () => ({ kind: 'produce', produce: 'carrot' })],
  [/brinjal/, () => ({ kind: 'produce', produce: 'brinjal' })],
  [/drumstick/, () => ({ kind: 'produce', produce: 'drumstick' })],
  [/ladies|okra/, () => ({ kind: 'produce', produce: 'okra' })],
  [/lemon/, () => ({ kind: 'produce', produce: 'lemon' })],
  [/green chilli/, () => ({ kind: 'produce', produce: 'chilli' })],
  [/curry leaves|coriander|spinach|keerai|mint/, () => ({ kind: 'produce', produce: 'leaves' })],
  [/garlic/, () => ({ kind: 'produce', produce: 'garlic' })],
  [/^coconut$/, () => ({ kind: 'produce', produce: 'coconut' })],
  [/banana/, () => ({ kind: 'produce', produce: 'banana' })],
  [/apple/, () => ({ kind: 'produce', produce: 'apple' })],
  [/papaya/, () => ({ kind: 'produce', produce: 'papaya' })],
  [/ginger/, () => ({ kind: 'produce', produce: 'ginger' })],

  // ---------------------------------------------------------------- staples
  [/ragi/, () => ({ kind: 'standup', base: '#8a4f32', base2: '#5e3220', accent: '#e8b04a', panel: '#f6e7cf', motif: 'grain', pattern: 'dots' })],
  [/atta|flour/, (p) => ({ kind: kg(p.unit) >= 5 ? 'sack' : 'standup', base: '#e6b24e', base2: '#c98a2e', accent: '#7a2e14', panel: '#fbf1d8', motif: 'wheat', pattern: 'none' })],
  [/idli rice/, () => ({ kind: 'pillow', base: '#f3f1ea', base2: '#dedbd0', accent: '#1f6f8b', panel: '#ffffff', motif: 'grain', pattern: 'grid' })],
  [/rice/, (p) => ({ kind: kg(p.unit) >= 5 ? 'sack' : 'pillow', base: '#f6f2e8', base2: '#e3dccb', accent: '#b5262b', panel: '#ffffff', motif: 'grain', pattern: 'stripes' })],
  [/urad/, () => ({ kind: 'pillow', base: '#f1ece1', base2: '#d9d1bf', accent: '#2d4f8a', panel: '#ffffff', motif: 'lentil', pattern: 'dots' })],
  [/moong/, () => ({ kind: 'pillow', base: '#a7cf5e', base2: '#7aa83c', accent: '#2c5a1f', panel: '#f4f9e6', motif: 'lentil', pattern: 'dots' })],
  [/dal|paruppu/, () => ({ kind: 'pillow', base: '#f7c843', base2: '#e39b1d', accent: '#1f6b3f', panel: '#fff7dc', motif: 'lentil', pattern: 'dots' })],
  [/salt/, () => ({ kind: 'standup', base: '#ffffff', base2: '#dbe7f6', accent: '#1458b8', panel: '#eef4fc', motif: 'salt', pattern: 'waves' })],
  [/sugar/, () => ({ kind: 'pillow', base: '#fbfbfb', base2: '#e5e8ee', accent: '#173f8f', panel: '#ffffff', motif: 'sparkle', pattern: 'dots' })],
  [/sunflower oil/, () => ({ kind: 'bottle-oil', base: '#f6cf3d', base2: '#e3a815', accent: '#1d7a3b', panel: '#fff8db', motif: 'sun', pattern: 'none' })],
  [/sesame|gingelly/, () => ({ kind: 'bottle-oil', base: '#c47a25', base2: '#8f5216', accent: '#7c1d1d', panel: '#fbecd2', motif: 'flower', pattern: 'none' })],
  [/hair oil/, () => ({ kind: 'bottle-flip', base: '#1f74c9', base2: '#155497', accent: '#ffffff', panel: '#e6f1fb', motif: 'coconut', pattern: 'waves' })],
  [/coconut oil/, () => ({ kind: 'bottle-oil', base: '#f4ecd2', base2: '#d9cfae', accent: '#1d5e3a', panel: '#ffffff', motif: 'coconut', pattern: 'none' })],
  [/cold coffee/, () => ({ kind: 'can', base: '#3b2418', base2: '#22140d', accent: '#d9a45b', panel: '#f3e3cc', motif: 'bean', pattern: 'stripes' })],
  [/coffee/, () => ({ kind: 'standup', base: '#4a2a1d', base2: '#2d1810', accent: '#d6a24a', panel: '#f4e4c8', motif: 'bean', pattern: 'none' })],
  [/tea/, () => ({ kind: 'tallbox', base: '#a91f24', base2: '#7b1418', accent: '#f1c14a', panel: '#fff3d6', motif: 'cup', pattern: 'none' })],
  [/sambar/, () => ({ kind: 'box', base: '#c0282d', base2: '#8f1a1e', accent: '#f6b021', panel: '#fff1d6', motif: 'spice', pattern: 'none' })],
  [/rasam/, () => ({ kind: 'pillow', base: '#e0571b', base2: '#b13e10', accent: '#5a1d0c', panel: '#fff0e0', motif: 'spice', pattern: 'dots' })],
  [/chilli powder/, () => ({ kind: 'pillow', base: '#b3191f', base2: '#7f1013', accent: '#f4c430', panel: '#fff0e0', motif: 'chilli', pattern: 'none' })],
  [/turmeric/, () => ({ kind: 'pillow', base: '#f2b01e', base2: '#d18c0b', accent: '#5b3415', panel: '#fff6dc', motif: 'spice', pattern: 'dots' })],
  [/fennel/, () => ({ kind: 'pillow', base: '#9cc45f', base2: '#709a3a', accent: '#2f4f1a', panel: '#f3f8e6', motif: 'leaf', pattern: 'none' })],
  [/tamarind/, () => ({ kind: 'pillow', base: '#5a3a26', base2: '#3b2416', accent: '#f29c1f', panel: '#f7e6cf', motif: 'leaf', pattern: 'none' })],
  [/jaggery/, () => ({ kind: 'bar', base: '#9a5b25', base2: '#6d3d15', accent: '#f0c05a', panel: '#f8e7c8', motif: 'sparkle', pattern: 'none' })],
  [/poha|beaten rice/, () => ({ kind: 'pillow', base: '#fff6df', base2: '#f0dfb5', accent: '#e06a12', panel: '#ffffff', motif: 'grain', pattern: 'stripes' })],
  [/sago/, () => ({ kind: 'pillow', base: '#ffffff', base2: '#e6e2f0', accent: '#5b3aa0', panel: '#f6f2ff', motif: 'pearl', pattern: 'dots' })],
  [/noodle/, () => ({ kind: 'pillow', base: '#f8c80d', base2: '#e0a800', accent: '#cf2027', panel: '#fff7d0', motif: 'noodle', pattern: 'none' })],
  [/batter/, () => ({ kind: 'tub', base: '#ffffff', base2: '#e9ecef', accent: '#1d7a46', panel: '#f2faf4', motif: 'grain', pattern: 'none' })],

  // ---------------------------------------------------------------- snacks
  [/chips/, () => ({ kind: 'pillow', base: '#f5c400', base2: '#e09d00', accent: '#c41e2a', panel: '#fff6cc', motif: 'chip', pattern: 'none' })],
  [/bhujia|mixture|namkeen/, () => ({ kind: 'pillow', base: '#f26b21', base2: '#c84d10', accent: '#3f1d0b', panel: '#fff0e0', motif: 'spice', pattern: 'none' })],
  [/murukku/, () => ({ kind: 'pillow', base: '#8e3a14', base2: '#64260b', accent: '#f6b730', panel: '#fbe9d2', motif: 'chip', pattern: 'dots' })],
  [/glucose/, () => ({ kind: 'pillow', base: '#f3cf45', base2: '#e2ad1b', accent: '#c4282c', panel: '#fff6d6', motif: 'cookie', pattern: 'none' })],
  [/rusk/, () => ({ kind: 'pillow', base: '#d6662a', base2: '#a84a18', accent: '#ffffff', panel: '#fff0e0', motif: 'bread', pattern: 'none' })],
  [/khara/, () => ({ kind: 'pillow', base: '#f19a2b', base2: '#cf7612', accent: '#6b2a0e', panel: '#fff3e0', motif: 'cookie', pattern: 'dots' })],
  [/coconut cookie/, () => ({ kind: 'box', base: '#8c6a54', base2: '#634a39', accent: '#f3e5c8', panel: '#fbf3e6', motif: 'coconut', pattern: 'none' })],
  [/cookie|biscuit/, () => ({ kind: 'box', base: '#e9822f', base2: '#bf5f17', accent: '#5a260c', panel: '#fff0dc', motif: 'cookie', pattern: 'none' })],

  // ---------------------------------------------------------------- beverages
  [/juice/, () => ({ kind: 'carton', base: '#ff9a1a', base2: '#e36f00', accent: '#2f7d32', panel: '#fff3dd', motif: 'fruit', pattern: 'none' })],
  [/coconut water/, () => ({ kind: 'carton', base: '#7cb342', base2: '#558b2f', accent: '#ffffff', panel: '#f1f8e9', motif: 'coconut', pattern: 'none' })],
  [/water/, () => ({ kind: 'bottle-pet', base: '#d6ecf8', base2: '#a9d3ee', accent: '#1565c0', panel: '#ffffff', motif: 'wave', pattern: 'none' })],

  // ---------------------------------------------------------------- bakery
  [/brown bread/, () => ({ kind: 'loaf', base: '#8a5530', base2: '#5f3519', accent: '#2f6b3a', panel: '#fff', motif: 'wheat', pattern: 'none' })],
  [/bread/, () => ({ kind: 'loaf', base: '#d99a4e', base2: '#b06d28', accent: '#c4282c', panel: '#fff', motif: 'bread', pattern: 'none' })],
  [/bun/, () => ({ kind: 'loaf', base: '#e2a24a', base2: '#b8741f', accent: '#1f5fa8', panel: '#fff', motif: 'bread', pattern: 'none' })],
  [/chocolate cake/, () => ({ kind: 'cake', base: '#3b2216', base2: '#24130b', accent: '#f2b632', panel: '#fff4e2', motif: 'cake', pattern: 'none' })],
  [/cake/, () => ({ kind: 'cake', base: '#7a2342', base2: '#53142b', accent: '#f6c445', panel: '#fff3e6', motif: 'cake', pattern: 'none' })],
  [/puff/, () => ({ kind: 'pastry', base: '#e3a33c', base2: '#b8761c', accent: '#8a3b12', panel: '#fff', motif: 'none', pattern: 'none' })],
  [/roll/, () => ({ kind: 'pastry', base: '#f3d29b', base2: '#d9a965', accent: '#ffffff', panel: '#fff', motif: 'none', pattern: 'none' })],

  // ---------------------------------------------------------------- dairy
  [/flavoured milk/, () => ({ kind: 'bottle-pet', base: '#f6a7c1', base2: '#e8799f', accent: '#8e1f4f', panel: '#fff0f5', motif: 'milk', pattern: 'none' })],
  [/full cream milk/, () => ({ kind: 'milkpouch', base: '#f7f7f4', base2: '#e4e1d8', accent: '#e2582a', panel: '#ffffff', motif: 'milk', pattern: 'waves' })],
  [/milk/, () => ({ kind: 'milkpouch', base: '#f7f7f4', base2: '#e4e1d8', accent: '#1f6fc5', panel: '#ffffff', motif: 'milk', pattern: 'waves' })],
  [/curd/, () => ({ kind: 'tub', base: '#ffffff', base2: '#e8ecf1', accent: '#1d5fb4', panel: '#eef4fc', motif: 'milk', pattern: 'none' })],
  [/buttermilk/, () => ({ kind: 'milkpouch', base: '#e9f6fb', base2: '#c9e5f1', accent: '#1b8a6b', panel: '#ffffff', motif: 'leaf', pattern: 'waves' })],
  [/lassi/, () => ({ kind: 'tub', base: '#ffe9c4', base2: '#f6cf8d', accent: '#c2410c', panel: '#fff8ec', motif: 'milk', pattern: 'none' })],
  [/paneer/, () => ({ kind: 'widebox', base: '#ffffff', base2: '#e8ece4', accent: '#2f7a3a', panel: '#f1f8ee', motif: 'milk', pattern: 'grid' })],
  [/ghee/, () => ({ kind: 'jar', base: '#f3c54b', base2: '#d9a225', accent: '#a3201f', panel: '#fff6dc', motif: 'drop', pattern: 'none' })],
  [/table butter|^butter/, () => ({ kind: 'bar', base: '#fde58a', base2: '#f3cc4c', accent: '#c8261f', panel: '#fffbea', motif: 'milk', pattern: 'none' })],
  [/cheese/, () => ({ kind: 'widebox', base: '#ffc928', base2: '#f0a800', accent: '#1555a8', panel: '#fff7d6', motif: 'milk', pattern: 'dots' })],
  [/egg/, () => ({ kind: 'eggs', base: '#c9b8a0', base2: '#a8977f', accent: '#2f6b3a', panel: '#fff', motif: 'egg', pattern: 'none' })],

  // ---------------------------------------------------------------- household
  [/detergent|wash powder/, () => ({ kind: 'standup', base: '#1d3f9a', base2: '#122a6d', accent: '#e53935', panel: '#e9f0ff', motif: 'bubbles', pattern: 'waves' })],
  [/dishwash bar/, () => ({ kind: 'bar', base: '#7bb83a', base2: '#5a8f24', accent: '#f6d01b', panel: '#f4fbe8', motif: 'fruit', pattern: 'none' })],
  [/dishwash/, () => ({ kind: 'bottle-flip', base: '#7bb83a', base2: '#5a8f24', accent: '#f6d01b', panel: '#f4fbe8', motif: 'fruit', pattern: 'none' })],
  [/floor cleaner/, () => ({ kind: 'bottle-flip', base: '#7c3aa8', base2: '#56237a', accent: '#f4f4f4', panel: '#f6eefc', motif: 'flower', pattern: 'none' })],
  [/toilet/, () => ({ kind: 'bottle-flip', base: '#1e63c4', base2: '#13458c', accent: '#ffffff', panel: '#eaf2fd', motif: 'sparkle', pattern: 'none' })],
  [/glass cleaner/, () => ({ kind: 'bottle-spray', base: '#3fb6ea', base2: '#1d8fc4', accent: '#ffffff', panel: '#eaf7fd', motif: 'sparkle', pattern: 'none' })],
  [/scrub/, () => ({ kind: 'box', base: '#3f9b3f', base2: '#2b7a2b', accent: '#f7d51d', panel: '#f1f9ec', motif: 'bubbles', pattern: 'none' })],
  [/garbage/, () => ({ kind: 'box', base: '#283238', base2: '#161c20', accent: '#8bd23f', panel: '#eef5e4', motif: 'leaf', pattern: 'grid' })],
  [/mosquito/, () => ({ kind: 'box', base: '#1e7a46', base2: '#135531', accent: '#f6b81d', panel: '#effaf2', motif: 'leaf', pattern: 'none' })],
  [/freshener/, () => ({ kind: 'tub', base: '#a24fc4', base2: '#7a3497', accent: '#ffffff', panel: '#f7eefc', motif: 'flower', pattern: 'none' })],

  // ---------------------------------------------------------------- personal care
  [/toothpaste/, () => ({ kind: 'widebox', base: '#d42a2a', base2: '#a11b1b', accent: '#ffffff', panel: '#ffffff', motif: 'tooth', pattern: 'none' })],
  [/toothbrush/, () => ({ kind: 'tallbox', base: '#1c6fd1', base2: '#134f99', accent: '#e53935', panel: '#eef5ff', motif: 'tooth', pattern: 'none' })],
  [/ayurvedic soap/, () => ({ kind: 'bar', base: '#2f6e2f', base2: '#1f4f1f', accent: '#f2c94c', panel: '#f0f7ea', motif: 'leaf', pattern: 'none' })],
  [/soap 4|soap 3|soap.*pack/, () => ({ kind: 'widebox', base: '#c62f2f', base2: '#951f1f', accent: '#ffffff', panel: '#fff1f1', motif: 'bubbles', pattern: 'none' })],
  [/soap/, () => ({ kind: 'bar', base: '#1f8a4c', base2: '#146536', accent: '#ffffff', panel: '#effaf3', motif: 'bubbles', pattern: 'none' })],
  [/shampoo/, (p) => ({ kind: 'bottle-flip', base: /silk/i.test(p.name.en) ? '#d63384' : '#7b2fa8', base2: /silk/i.test(p.name.en) ? '#a31f62' : '#561d78', accent: '#ffffff', panel: '#fff', motif: 'flower', pattern: 'none' })],
  [/hand wash/, () => ({ kind: 'standup', base: '#22924f', base2: '#166a38', accent: '#ffffff', panel: '#effaf3', motif: 'bubbles', pattern: 'waves' })],
  [/face wash/, () => ({ kind: 'bottle-flip', base: '#0f8a7e', base2: '#0a6359', accent: '#f4d35e', panel: '#eafaf7', motif: 'leaf', pattern: 'none' })],
  [/cream/, () => ({ kind: 'jar', base: '#f6f6f6', base2: '#dfe3e8', accent: '#1e74d6', panel: '#ffffff', motif: 'flower', pattern: 'none' })],
]

const DEPT_FALLBACK: Record<Department, (shape: PackShape) => Partial3> = {
  fresh: () => ({ kind: 'produce', produce: 'mixed' }),
  pantry: () => ({ kind: 'pillow', motif: 'grain', pattern: 'dots' }),
  chilled: () => ({ kind: 'tub', motif: 'milk' }),
  household: () => ({ kind: 'bottle-flip', motif: 'sparkle' }),
  personal_care: () => ({ kind: 'box', motif: 'flower' }),
  snacks: () => ({ kind: 'pillow', motif: 'chip' }),
  beverages: () => ({ kind: 'carton', motif: 'fruit' }),
  bakery: () => ({ kind: 'loaf', motif: 'bread' }),
}

const PRODUCE_BASE: Record<Produce, [string, string]> = {
  tomato: ['#d9302c', '#a81d1b'],
  onion: ['#a2405f', '#73293f'],
  potato: ['#c49a5c', '#94703a'],
  carrot: ['#ee7a1f', '#c45a0c'],
  brinjal: ['#5b2a6e', '#3b1849'],
  drumstick: ['#6f9a3a', '#4d7224'],
  okra: ['#7fae3f', '#5b8526'],
  lemon: ['#f2d23a', '#d6ae12'],
  chilli: ['#3f8f2f', '#2a6a1e'],
  leaves: ['#3f8a36', '#2a6524'],
  garlic: ['#efe8dc', '#d4c8b5'],
  coconut: ['#7a5232', '#53351e'],
  banana: ['#f1cf3b', '#d1a816'],
  apple: ['#c4232f', '#8f1620'],
  papaya: ['#f08a2a', '#7aa33a'],
  ginger: ['#c9a36b', '#9c7a45'],
  mixed: ['#d9302c', '#3f8a36'],
}

const cache = new Map<string, PackDesign>()

/** The pack design for a product. Deterministic and cached by id. */
export function designFor(p: PackSource): PackDesign {
  const hit = cache.get(p.id)
  if (hit) return hit
  const name = p.name.en.toLowerCase()
  const seed = hash(p.id + p.brand)
  let partial: Partial3 = {}
  for (const [re, fn] of RULES) {
    if (re.test(name)) {
      partial = fn(p)
      break
    }
  }
  if (!partial.kind) partial = { ...DEPT_FALLBACK[p.department](p.shape), ...partial }

  const fromColor = p.color.startsWith('#') ? p.color : '#ee5a36'
  const base = partial.base ?? (partial.kind === 'produce' ? PRODUCE_BASE[partial.produce ?? 'mixed'][0] : fromColor)
  const base2 = partial.base2 ?? (partial.kind === 'produce' ? PRODUCE_BASE[partial.produce ?? 'mixed'][1] : shade(base, -0.25))
  const accent = partial.accent ?? shade(base, -0.55)
  const d: PackDesign = {
    kind: partial.kind ?? 'box',
    motif: partial.motif ?? 'none',
    produce: partial.produce,
    base,
    base2,
    accent,
    panel: partial.panel ?? '#fffaf0',
    ink: inkOn(base),
    accentInk: inkOn(accent),
    pattern: partial.pattern ?? (['dots', 'stripes', 'waves', 'none'] as const)[seed % 4],
    seed,
  }
  cache.set(p.id, d)
  return d
}
