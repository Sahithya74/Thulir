import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { Human, lookFor, type Gait } from '@/scenes/stores/Human'

const LOOP = 120

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

interface Walker {
  z: number
  dir: number
  offset: number
  speed: number
  scale: number
  phase: number
}

function Stroller({ w, index, reducedMotion }: { w: Walker; index: number; reducedMotion: boolean }) {
  const g = useRef<Group>(null)
  const look = useMemo(() => ({ ...lookFor(index + 2), basket: false }), [index])
  const gait = useRef<Gait>({ phase: w.phase, speed: 0.9, time: 0 })
  useFrame(({ clock }, dt) => {
    const grp = g.current
    if (!grp) return
    const t = clock.elapsedTime
    let x = ((w.offset + (reducedMotion ? 0 : t * w.speed * w.dir)) % LOOP) - LOOP / 2
    if (x < -LOOP / 2) x += LOOP
    grp.position.x = x
    const k = gait.current
    k.time = t
    k.speed = reducedMotion ? 0 : 0.9
    if (!reducedMotion) k.phase += dt * w.speed * 2.6
  })
  return (
    <group ref={g} position={[0, 0, w.z]} rotation={[0, w.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0]} scale={w.scale}>
      <Human look={look} gait={gait} />
    </group>
  )
}

/**
 * Townspeople strolling both pavements: the same people as inside the shops, scaled to the street. A handful, not a
 * crowd — enough to show the place is lived in without hiding the shops.
 */
export function Townspeople({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const list = useMemo<Walker[]>(() => {
    const r = rng(41)
    return Array.from({ length: count }, (_, i) => ({
      z: (i % 2 ? 1 : -1) * (5.1 + r() * 1.6),
      dir: r() > 0.5 ? 1 : -1,
      offset: r() * LOOP,
      speed: 0.8 + r() * 0.6,
      scale: 0.6 + r() * 0.05,
      phase: r() * 6.28,
    }))
  }, [count])
  return (
    <group>
      {list.map((w, i) => (
        <Stroller key={i} w={w} index={i} reducedMotion={reducedMotion} />
      ))}
    </group>
  )
}
