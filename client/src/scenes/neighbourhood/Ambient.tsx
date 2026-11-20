import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Object3D, type InstancedMesh } from 'three'
import { BOX, mat } from './shared3d'
import { AVENUE_HALF_WIDTH } from './layout'

const LANES = [
  { z: -2.3, dir: 1 },
  { z: 2.3, dir: -1 },
]
const COLORS = ['#e9e5d9', '#77856b', '#c98255', '#292c29', '#a8b89a', '#f5f2ea']
const LOOP = 110

interface Veh {
  lane: number
  offset: number
  speed: number
  color: string
}

/** A few slow vehicles on the avenue (one instanced mesh for bodies, one for cabins). Frozen under reduced motion. */
export function Vehicles({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const bodies = useRef<InstancedMesh>(null)
  const cabins = useRef<InstancedMesh>(null)
  const list = useMemo<Veh[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        lane: i % 2,
        offset: (i / count) * LOOP,
        speed: 1.4 + ((i * 37) % 10) / 14,
        color: COLORS[i % COLORS.length],
      })),
    [count],
  )
  const o = useMemo(() => new Object3D(), [])

  useEffect(() => {
    const col = new Color()
    list.forEach((v, i) => bodies.current?.setColorAt(i, col.set(v.color)))
    if (bodies.current?.instanceColor) bodies.current.instanceColor.needsUpdate = true
  }, [list])

  const place = (t: number) => {
    list.forEach((v, i) => {
      const lane = LANES[v.lane]
      const travelled = reducedMotion ? 0 : t * v.speed
      let x = ((v.offset + travelled * lane.dir) % LOOP) - LOOP / 2
      if (x < -LOOP / 2) x += LOOP
      // vehicles stop short of the central plaza crossing zone only visually; keep simple
      o.position.set(x, 0.6, lane.z * (AVENUE_HALF_WIDTH / 4.5))
      o.rotation.set(0, lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0)
      o.scale.set(1.7, 0.7, 3.8)
      o.updateMatrix()
      bodies.current?.setMatrixAt(i, o.matrix)
      o.position.y = 1.15
      o.scale.set(1.45, 0.5, 2.0)
      o.updateMatrix()
      cabins.current?.setMatrixAt(i, o.matrix)
    })
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true
    if (cabins.current) cabins.current.instanceMatrix.needsUpdate = true
  }

  useEffect(() => place(0), [list, reducedMotion]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => {
    if (!reducedMotion) place(clock.elapsedTime)
  })

  return (
    <>
      <instancedMesh ref={bodies} args={[BOX, mat('#ffffff'), count]} frustumCulled={false} castShadow />
      <instancedMesh ref={cabins} args={[BOX, mat('#222826', { roughness: 0.3 }), count]} frustumCulled={false} />
    </>
  )
}
