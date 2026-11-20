import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, PlaneGeometry, type MeshStandardMaterialParameters } from 'three'

/** Shared unit geometries — meshes scale these instead of allocating their own. */
export const BOX = new BoxGeometry(1, 1, 1)
export const CYL = new CylinderGeometry(1, 1, 1, 20)
export const PLANE = new PlaneGeometry(1, 1)

const cache = new Map<string, MeshStandardMaterial>()

/** Cached matte material per colour/option combination. */
export function mat(color: string, opts: MeshStandardMaterialParameters = {}): MeshStandardMaterial {
  const key = color + JSON.stringify(opts)
  let m = cache.get(key)
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...opts })
    cache.set(key, m)
  }
  return m
}

export const glassMat = (warm = 0.35) =>
  mat('#2a3836', { roughness: 0.18, metalness: 0.3, emissive: '#ffcf8f', emissiveIntensity: warm })
