import type { StoreCategory } from '@thulir/shared'

/**
 * World layout of the mid-city commercial district (units ≈ metres, y is up).
 * A central avenue runs along the X axis. North-side buildings (negative z) face +z, south-side face -z.
 */
export const AVENUE_HALF_WIDTH = 4.5
export const SIDEWALK_HALF_WIDTH = 7

export interface Plot {
  storeId: string
  category: StoreCategory
  x: number
  z: number
  w: number
  d: number
  h: number
  /** Direction the shopfront faces. */
  faces: 'north' | 'south'
}

/** Local +z is the shopfront. Plots with z>0 face 'north' and are rotated π so their front meets the avenue. */
export const plots: Plot[] = [
  { storeId: 'store-marutham', category: 'supermarket', x: -19, z: -17, w: 17, d: 10, h: 6.5, faces: 'south' },
  { storeId: 'store-thenral', category: 'dairy', x: 9, z: -12.5, w: 6.5, d: 7, h: 6, faces: 'south' },
  { storeId: 'store-illam', category: 'household', x: 18.5, z: -12.5, w: 8, d: 7, h: 7.5, faces: 'south' },
  { storeId: 'store-selvam', category: 'provision', x: -14, z: 12.5, w: 8, d: 7, h: 8, faces: 'north' },
  { storeId: 'store-pasumai', category: 'fruit_veg', x: -2.5, z: 13, w: 11, d: 8, h: 5, faces: 'north' },
  { storeId: 'store-madhuram', category: 'bakery', x: 9.5, z: 12.5, w: 7, d: 7, h: 6.5, faces: 'north' },
]

export const plotByStore = Object.fromEntries(plots.map((p) => [p.storeId, p]))

/** Shopping complex landmark (decorative, not a store). */
export const complex = { x: -3, z: -15, w: 13, d: 11, h: 14 }

export interface CameraPose {
  tx: number
  ty: number
  tz: number
  theta: number
  phi: number
  radius: number
}

export const POSES = {
  /** Far aerial — the opening shot. */
  intro: { tx: 2, ty: 0, tz: 0, theta: 1.25, phi: 0.5, radius: 170 },
  /** Default overview of the whole district. */
  overview: { tx: 0, ty: 0, tz: -2, theta: 0.45, phi: 0.82, radius: 88 },
  /** Lower, immersive view down the avenue. */
  explore: { tx: 0, ty: 2, tz: 3, theta: 0.35, phi: 1.25, radius: 40 },
} satisfies Record<string, CameraPose>

export const LIMITS = { minRadius: 12, maxRadius: 140, minPhi: 0.3, maxPhi: 1.48 }

/** Camera pose framing a given plot head-on from the avenue side. */
export function focusPose(p: Plot): CameraPose {
  return {
    tx: p.x,
    ty: Math.min(p.h * 0.45, 3.4),
    tz: p.z,
    theta: (p.faces === 'south' ? 0 : Math.PI) + (p.x > 0 ? -0.28 : 0.28),
    phi: 1.2,
    radius: Math.max(p.w, 9) * 1.7 + 5,
  }
}

/** Pose at the shop door — the last beat of the camera before the store-entry wipe. */
export function enterPose(p: Plot): CameraPose {
  const frontZ = p.z + (p.faces === 'south' ? p.d / 2 : -p.d / 2)
  return {
    tx: p.x,
    ty: 1.6,
    tz: frontZ,
    theta: p.faces === 'south' ? 0 : Math.PI,
    phi: 1.42,
    radius: 5.5,
  }
}
