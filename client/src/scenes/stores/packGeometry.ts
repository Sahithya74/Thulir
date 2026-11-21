import { BoxGeometry, CylinderGeometry, LatheGeometry, SphereGeometry, TorusGeometry, ConeGeometry, Vector2, type BufferGeometry } from 'three'
import type { ArtKind } from '@/components/products/packDesign'

/**
 * Shared geometry for 3D packs, built once and reused by every product on every shelf. Pouches are boxes whose
 * faces are puffed out (and pinched at the sealed ends); bottles, jars and tubs are lathed from a profile, so their
 * silhouettes read as the real thing from any angle.
 */
const geo = new Map<string, BufferGeometry>()
const once = (k: string, f: () => BufferGeometry) => {
  let g = geo.get(k)
  if (!g) {
    g = f()
    geo.set(k, g)
  }
  return g
}

/** Puff a unit box: `profile(nx, ny)` (each −1…1) returns the thickness multiplier at that point of the face. */
function puffed(profile: (nx: number, ny: number) => number): BufferGeometry {
  const g = new BoxGeometry(1, 1, 1, 10, 14, 2)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    pos.setZ(i, pos.getZ(i) * profile(x * 2, y * 2))
  }
  g.computeVertexNormals()
  return g
}

export const pillowGeo = () => once('pillow', () => puffed((nx, ny) => 0.16 + 0.84 * (1 - ny ** 6) * (1 - 0.35 * nx ** 4)))
export const standupGeo = () => once('standup', () => puffed((nx, ny) => 0.12 + 0.88 * (1 - ((ny + 1) / 2) ** 3) * (1 - 0.3 * nx ** 6)))
export const sackGeo = () => once('sack', () => puffed((nx, ny) => 0.55 + 0.45 * (1 - ny ** 4) * (1 - 0.3 * nx ** 4)))
export const milkPouchGeo = () => once('milkpouch', () => puffed((nx, ny) => 0.1 + 0.9 * (1 - ny ** 4) * (1 - nx ** 6)))
export const boxGeo = () => once('box', () => new BoxGeometry(1, 1, 1))

const lathe = (k: string, pts: [number, number][]) => once(k, () => new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), 32))

/** Profiles: [radius, height] from the bottom up, for a unit-height bottle of radius 1. */
export const bottleOilGeo = () =>
  lathe('oil', [[0, 0], [0.92, 0], [1, 0.04], [1, 0.42], [0.9, 0.48], [1, 0.54], [1, 0.7], [0.82, 0.8], [0.42, 0.88], [0.36, 0.92], [0.36, 0.95], [0, 0.95]])
export const bottlePetGeo = () =>
  lathe('pet', [[0, 0], [0.85, 0], [1, 0.05], [1, 0.62], [0.9, 0.72], [0.45, 0.85], [0.34, 0.9], [0.34, 0.95], [0, 0.95]])
export const bottleFlipGeo = () =>
  lathe('flip', [[0, 0], [0.9, 0], [1, 0.05], [1, 0.82], [0.88, 0.9], [0.55, 0.96], [0.42, 0.97], [0, 0.97]])
export const jarGeo = () => lathe('jar', [[0, 0], [0.9, 0], [1, 0.06], [1, 0.84], [0.92, 0.9], [0.86, 0.9], [0, 0.9]])
export const tubGeo = () => lathe('tub', [[0, 0], [0.8, 0], [0.84, 0.04], [1, 0.9], [1.04, 0.92], [0, 0.92]])
export const canGeo = () => once('can', () => new CylinderGeometry(1, 1, 1, 32))

/** Open cylinder band for wrap-around labels; the middle of the texture faces +z (the shopper). */
export const labelBandGeo = (taper = 0) => once(`band${taper}`, () => new CylinderGeometry(1, 1 - taper, 1, 40, 1, true, Math.PI, Math.PI * 2))
export const capGeo = () => once('cap', () => new CylinderGeometry(1, 1, 1, 24))

export const sphereGeo = () => once('sphere', () => new SphereGeometry(1, 16, 12))
export const coneGeo = () => once('cone', () => new ConeGeometry(1, 1, 12))
export const bananaGeo = () => once('banana', () => new TorusGeometry(1, 0.16, 8, 16, Math.PI * 0.55))
export const stickGeo = () => once('stick', () => new CylinderGeometry(1, 0.7, 1, 8))

/** Footprint of one unit of each pack kind on the shelf, before the product's size scale: [width, height, depth]. */
export const UNIT: Record<ArtKind, [number, number, number]> = {
  sack: [1.15, 1.35, 0.55],
  pillow: [0.74, 1.0, 0.34],
  standup: [0.7, 1.0, 0.4],
  box: [0.76, 1.0, 0.42],
  tallbox: [0.55, 1.12, 0.38],
  widebox: [1.0, 0.56, 0.42],
  'bottle-oil': [0.5, 1.35, 0.5],
  'bottle-pet': [0.44, 1.3, 0.44],
  'bottle-flip': [0.56, 1.12, 0.56],
  'bottle-spray': [0.54, 1.2, 0.54],
  jar: [0.7, 0.78, 0.7],
  tub: [0.78, 0.56, 0.78],
  carton: [0.52, 1.08, 0.42],
  gable: [0.54, 1.12, 0.54],
  milkpouch: [0.78, 0.72, 0.3],
  can: [0.44, 0.66, 0.44],
  bar: [0.92, 0.36, 0.5],
  loaf: [1.1, 0.75, 0.5],
  cake: [1.0, 0.75, 0.5],
  pastry: [0.9, 0.7, 0.5],
  eggs: [1.05, 0.62, 0.55],
  produce: [1.55, 1.0, 0.95],
}
