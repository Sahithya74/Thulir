import { useEffect, useMemo, useRef } from 'react'
import { Color, MeshStandardMaterial, Object3D, type InstancedMesh } from 'three'
import { BOX } from './shared3d'
import { makeFacadeTexture } from './palette'

/** Deterministic PRNG so the skyline is identical on every load. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

interface Block {
  x: number
  z: number
  w: number
  d: number
  floors: number
  tint: string
}

const TINTS = ['#f2f6fb', '#e4ecf6', '#d6e2ee', '#f7eee6', '#e6dff0', '#d9ece6']
const FLOOR_H = 3.2

function buildBlocks(count: number): Block[] {
  const r = rng(7)
  const blocks: Block[] = []
  let attempts = 0
  while (blocks.length < count && attempts < count * 40) {
    attempts++
    const side = r() > 0.5 ? 1 : -1
    const x = (r() - 0.5) * 170
    const z = side * (36 + r() * 46)
    const w = 6 + r() * 4
    const d = 6 + r() * 4
    // keep clear of the hero district footprint
    if (Math.abs(z) < 40 && x > -36 && x < 30) continue
    // thin out the far field so the skyline fades naturally
    const dist = Math.hypot(x, z)
    // keep the camera-facing (south) side low so it never walls off the district
    const floors = side > 0 ? 2 + Math.floor(r() * 2) : dist < 60 ? 3 + Math.floor(r() * 3) : 2 + Math.floor(r() * 3)
    blocks.push({ x, z, w, d, floors, tint: TINTS[Math.floor(r() * TINTS.length)] })
  }
  return blocks
}

function FloorGroup({ blocks, floors, shadows }: { blocks: Block[]; floors: number; shadows: boolean }) {
  const ref = useRef<InstancedMesh>(null)
  const { material, texture } = useMemo(() => {
    const texture = makeFacadeTexture('#ffffff', '#3a4643')
    texture.repeat.set(2, floors)
    const material = new MeshStandardMaterial({ map: texture, roughness: 0.9 })
    return { material, texture }
  }, [floors])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    const col = new Color()
    blocks.forEach((b, i) => {
      const h = floors * FLOOR_H
      o.position.set(b.x, h / 2, b.z)
      o.scale.set(b.w, h, b.d)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, col.set(b.tint))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [blocks, floors])

  useEffect(
    () => () => {
      material.dispose()
      texture.dispose()
    },
    [material, texture],
  )

  if (blocks.length === 0) return null
  return <instancedMesh ref={ref} args={[BOX, material, blocks.length]} castShadow={shadows} receiveShadow={shadows} frustumCulled={false} />
}

/** Instanced mid-rise mixed-use blocks that give the district its town-centre depth. One draw call per floor-count. */
export function CityBlocks({ low, shadows }: { low: boolean; shadows: boolean }) {
  const blocks = useMemo(() => buildBlocks(low ? 34 : 70), [low])
  const groups = useMemo(() => {
    const m = new Map<number, Block[]>()
    for (const b of blocks) m.set(b.floors, [...(m.get(b.floors) ?? []), b])
    return [...m.entries()]
  }, [blocks])
  return (
    <group>
      {groups.map(([floors, list]) => (
        <FloorGroup key={floors} floors={floors} blocks={list} shadows={shadows} />
      ))}
    </group>
  )
}
