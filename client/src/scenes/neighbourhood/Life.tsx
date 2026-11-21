import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Object3D, type Group, type InstancedMesh } from 'three'
import { BOX, CYL, mat } from './shared3d'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const SHIRTS = ['#ee5a36', '#0b8079', '#ffc233', '#3b6fd4', '#8a4fd0', '#e0457b', '#2f9e5b', '#ffffff', '#1b2b3c']
const SKIN = ['#8a5a3c', '#a8714a', '#6d4228', '#c08a5e', '#b07b55']
const LOOP = 120

interface Walker {
  z: number
  dir: number
  offset: number
  speed: number
  shirt: string
  skin: string
  scale: number
  phase: number
}

/**
 * Townspeople strolling along both pavements and the plaza: three instanced meshes (legs, torsos, heads) so a crowd of
 * a few dozen costs three draw calls. Each person bobs as they step. Frozen under reduced motion.
 */
export function Pedestrians({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const legs = useRef<InstancedMesh>(null)
  const torsos = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const list = useMemo<Walker[]>(() => {
    const r = rng(41)
    return Array.from({ length: count }, (_, i) => ({
      z: (i % 2 ? 1 : -1) * (5.1 + r() * 1.6),
      dir: r() > 0.5 ? 1 : -1,
      offset: r() * LOOP,
      speed: 0.9 + r() * 1.1,
      shirt: SHIRTS[Math.floor(r() * SHIRTS.length)],
      skin: SKIN[Math.floor(r() * SKIN.length)],
      scale: 0.9 + r() * 0.2,
      phase: r() * 6.28,
    }))
  }, [count])
  const o = useMemo(() => new Object3D(), [])

  useEffect(() => {
    const c = new Color()
    list.forEach((w, i) => {
      torsos.current?.setColorAt(i, c.set(w.shirt))
      heads.current?.setColorAt(i, c.set(w.skin))
    })
    for (const m of [torsos.current, heads.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [list])

  const place = (t: number) => {
    list.forEach((w, i) => {
      let x = ((w.offset + (reducedMotion ? 0 : t * w.speed * w.dir)) % LOOP) - LOOP / 2
      if (x < -LOOP / 2) x += LOOP
      const step = reducedMotion ? 0 : Math.abs(Math.sin(t * w.speed * 3.2 + w.phase)) * 0.08
      const sc = w.scale
      const face = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2
      o.rotation.set(0, face, 0)
      o.position.set(x, 0.38 * sc + step, w.z)
      o.scale.set(0.34 * sc, 0.76 * sc, 0.24 * sc)
      o.updateMatrix()
      legs.current?.setMatrixAt(i, o.matrix)
      o.position.set(x, 1.12 * sc + step, w.z)
      o.scale.set(0.42 * sc, 0.74 * sc, 0.3 * sc)
      o.updateMatrix()
      torsos.current?.setMatrixAt(i, o.matrix)
      o.position.set(x, 1.68 * sc + step, w.z)
      o.scale.set(0.27 * sc, 0.3 * sc, 0.27 * sc)
      o.updateMatrix()
      heads.current?.setMatrixAt(i, o.matrix)
    })
    for (const m of [legs.current, torsos.current, heads.current]) if (m) m.instanceMatrix.needsUpdate = true
  }

  useEffect(() => place(0), [list, reducedMotion]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }) => {
    if (!reducedMotion) place(clock.elapsedTime)
  })

  return (
    <>
      <instancedMesh ref={legs} args={[BOX, mat('#26364a'), count]} frustumCulled={false} />
      <instancedMesh ref={torsos} args={[CYL, mat('#ffffff'), count]} frustumCulled={false} />
      <instancedMesh ref={heads} args={[CYL, mat('#ffffff'), count]} frustumCulled={false} />
    </>
  )
}

/** Soft clouds drifting slowly across the sky. */
export function Clouds({ reducedMotion }: { reducedMotion: boolean }) {
  const refs = useRef<Group[]>([])
  const clouds = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: 9 }, () => ({
      x: (r() - 0.5) * 360,
      y: 52 + r() * 26,
      z: -90 + r() * 150,
      s: 0.8 + r() * 1.2,
      v: 0.9 + r() * 1.4,
    }))
  }, [])
  useFrame(({ clock }) => {
    if (reducedMotion) return
    clouds.forEach((c, i) => {
      const g = refs.current[i]
      if (!g) return
      let x = c.x + clock.elapsedTime * c.v
      x = ((x + 200) % 400) - 200
      g.position.x = x
    })
  })
  const cloud = mat('#ffffff', { transparent: true, opacity: 0.92, roughness: 1 })
  return (
    <group>
      {clouds.map((c, i) => (
        <group key={i} ref={(g) => { if (g) refs.current[i] = g }} position={[c.x, c.y, c.z]} scale={c.s}>
          <mesh material={cloud} scale={[16, 4.5, 8]}><sphereGeometry args={[1, 12, 8]} /></mesh>
          <mesh material={cloud} position={[8, -0.5, 1]} scale={[11, 3.6, 6.5]}><sphereGeometry args={[1, 12, 8]} /></mesh>
          <mesh material={cloud} position={[-8.5, -0.8, -1]} scale={[10, 3.2, 6]}><sphereGeometry args={[1, 12, 8]} /></mesh>
        </group>
      ))}
    </group>
  )
}

/** A small flock circling over the district, wings flapping. */
export function Birds({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const refs = useRef<Group[]>([])
  const wings = useRef<{ l: Object3D; r: Object3D }[]>([])
  const specs = useMemo(() => {
    const r = rng(19)
    return Array.from({ length: count }, (_, i) => ({ radius: 26 + r() * 30, h: 20 + r() * 10, a: (i / count) * 6.28, v: 0.14 + r() * 0.1, ph: r() * 6 }))
  }, [count])
  useFrame(({ clock }) => {
    if (reducedMotion) return
    const t = clock.elapsedTime
    specs.forEach((b, i) => {
      const g = refs.current[i]
      if (!g) return
      const a = b.a + t * b.v
      g.position.set(Math.cos(a) * b.radius, b.h + Math.sin(t * 0.7 + b.ph) * 1.2, Math.sin(a) * b.radius * 0.7)
      g.rotation.y = -a + Math.PI
      const flap = Math.sin(t * 9 + b.ph) * 0.7
      const w = wings.current[i]
      if (w) {
        w.l.rotation.z = flap
        w.r.rotation.z = -flap
      }
    })
  })
  const m = mat('#1b2b3c')
  return (
    <group>
      {specs.map((_, i) => (
        <group key={i} ref={(g) => { if (g) refs.current[i] = g }}>
          <mesh geometry={BOX} material={m} scale={[0.5, 0.25, 0.9]} />
          <group ref={(g) => { if (g) wings.current[i] = { ...(wings.current[i] ?? {}), l: g } as never }} position={[0.25, 0.05, 0]}>
            <mesh geometry={BOX} material={m} position={[0.6, 0, 0]} scale={[1.3, 0.05, 0.5]} />
          </group>
          <group ref={(g) => { if (g) wings.current[i] = { ...(wings.current[i] ?? {}), r: g } as never }} position={[-0.25, 0.05, 0]}>
            <mesh geometry={BOX} material={m} position={[-0.6, 0, 0]} scale={[1.3, 0.05, 0.5]} />
          </group>
        </group>
      ))}
    </group>
  )
}
