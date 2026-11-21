import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { Human, lookFor, type Gait } from './Human'
import { laneAt, makeSpecs, type Spec } from './WalkLife'
import type { WalkPlan } from './walkLayout'

function Person({ spec, index, reducedMotion }: { spec: Spec; index: number; reducedMotion: boolean }) {
  const outer = useRef<Group>(null)
  const look = useMemo(() => lookFor(index), [index])
  const gait = useRef<Gait>({ phase: spec.phase, speed: 0, time: 0 })
  const last = useRef({ x: spec.from })

  useFrame(({ clock }, dt) => {
    const g = outer.current
    if (!g) return
    const { x, yaw } = laneAt(spec, clock.elapsedTime, reducedMotion)
    const v = dt > 0 ? Math.abs(x - last.current.x) / dt : 0
    last.current.x = x
    g.position.x = x
    g.rotation.y = yaw
    const k = gait.current
    k.time = clock.elapsedTime
    // Stride follows the real pace, so they ease to a stop at the ends of the aisle and stroll in between.
    k.speed += (Math.min(1.3, v / 2.4) - k.speed) * Math.min(1, dt * 6)
    if (!reducedMotion) k.phase += dt * v * 1.9
    else k.speed = 0
  })

  return (
    <group ref={outer} position={[spec.from, 0, spec.lane]}>
      <Human look={look} gait={gait} />
    </group>
  )
}

/** Shoppers strolling the aisles: real-proportioned people with faces, hair and everyday clothes. */
export function Shoppers({ plan, reducedMotion, count }: { plan: WalkPlan; reducedMotion: boolean; count: number }) {
  const specs = useMemo(() => makeSpecs(plan, count), [plan, count])
  return (
    <group>
      {specs.map((s, i) => (
        <Person key={i} spec={s} index={i} reducedMotion={reducedMotion} />
      ))}
    </group>
  )
}
