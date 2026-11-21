import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { BOX, CYL, mat } from '@/scenes/neighbourhood/shared3d'
import type { WalkPlan } from './walkLayout'

const SHIRTS = ['#ee5a36', '#0b8079', '#ffc233', '#3b6fd4', '#8a4fd0', '#e0457b', '#2f9e5b']
const SKIN = ['#8a5a3c', '#a8714a', '#6d4228', '#c08a5e']
const HAIR = '#1b1410'

interface Spec {
  lane: number
  from: number
  to: number
  speed: number
  phase: number
  shirt: string
  skin: string
  basket: boolean
}

/** One shopper: walks an aisle lane back and forth, pausing now and then to look at the shelves. */
function Shopper({ spec, reducedMotion }: { spec: Spec; reducedMotion: boolean }) {
  const g = useRef<Group>(null)
  const legL = useRef<Group>(null)
  const legR = useRef<Group>(null)
  const head = useRef<Group>(null)
  useFrame(({ clock }) => {
    const grp = g.current
    if (!grp) return
    const span = spec.to - spec.from
    const t = reducedMotion ? spec.phase : clock.elapsedTime * spec.speed + spec.phase
    const cycle = (t / span) % 2
    const u = cycle < 1 ? cycle : 2 - cycle
    // ease in and out at the ends, and linger mid-aisle
    const e = u * u * (3 - 2 * u)
    const pause = Math.sin(u * Math.PI * 4)
    const x = spec.from + span * (0.88 * e + 0.12 * u)
    grp.position.x = x
    grp.rotation.y = cycle < 1 ? Math.PI / 2 : -Math.PI / 2
    const walking = reducedMotion ? 0 : Math.abs(pause) > 0.18 ? 1 : 0.15
    const swing = Math.sin(clock.elapsedTime * 6 + spec.phase) * 0.5 * walking
    if (legL.current) legL.current.rotation.x = swing
    if (legR.current) legR.current.rotation.x = -swing
    grp.position.y = Math.abs(Math.sin(clock.elapsedTime * 6 + spec.phase)) * 0.05 * walking
    if (head.current) head.current.rotation.y = Math.sin(clock.elapsedTime * 0.8 + spec.phase) * 0.7 * (1 - walking * 0.6)
  })
  return (
    <group ref={g} position={[spec.from, 0, spec.lane]}>
      <group ref={legL} position={[-0.14, 1.25, 0]}>
        <mesh geometry={BOX} material={mat('#26364a')} position={[0, -0.6, 0]} scale={[0.2, 1.2, 0.22]} />
      </group>
      <group ref={legR} position={[0.14, 1.25, 0]}>
        <mesh geometry={BOX} material={mat('#26364a')} position={[0, -0.6, 0]} scale={[0.2, 1.2, 0.22]} />
      </group>
      <mesh geometry={CYL} material={mat(spec.shirt)} position={[0, 1.95, 0]} scale={[0.34, 1.3, 0.24]} />
      <group ref={head} position={[0, 2.85, 0]}>
        <mesh geometry={CYL} material={mat(spec.skin)} scale={[0.26, 0.4, 0.26]} />
        <mesh geometry={CYL} material={mat(HAIR)} position={[0, 0.16, -0.03]} scale={[0.28, 0.16, 0.28]} />
      </group>
      <mesh geometry={BOX} material={mat(spec.skin)} position={[0.36, 1.9, 0.05]} scale={[0.12, 0.85, 0.14]} />
      <mesh geometry={BOX} material={mat(spec.skin)} position={[-0.36, 1.9, 0.05]} scale={[0.12, 0.85, 0.14]} />
      {spec.basket && (
        <mesh geometry={BOX} material={mat(spec.shirt === '#ee5a36' ? '#0b8079' : '#ee5a36')} position={[0.5, 1.2, 0.2]} scale={[0.5, 0.3, 0.4]} />
      )}
    </group>
  )
}

/** A handful of shoppers drifting down the aisles so the store never looks frozen. */
export function Shoppers({ plan, reducedMotion, count }: { plan: WalkPlan; reducedMotion: boolean; count: number }) {
  const specs = useMemo<Spec[]>(() => {
    const out: Spec[] = []
    const lanes = plan.lanesZ
    for (let i = 0; i < count; i++) {
      const lane = lanes[i % lanes.length] + (i % 2 ? 0.7 : -0.7)
      const half = plan.width / 2 - 3
      out.push({
        lane,
        from: -half + (i % 3),
        to: half - ((i * 2) % 3),
        speed: 0.55 + ((i * 37) % 10) / 30,
        phase: i * 7.3,
        shirt: SHIRTS[i % SHIRTS.length],
        skin: SKIN[i % SKIN.length],
        basket: i % 2 === 0,
      })
    }
    return out
  }, [plan, count])
  return (
    <group>
      {specs.map((s, i) => (
        <Shopper key={i} spec={s} reducedMotion={reducedMotion} />
      ))}
    </group>
  )
}
