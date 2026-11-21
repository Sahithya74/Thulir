import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CapsuleGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, type BufferGeometry, type Group, type MeshStandardMaterial } from 'three'
import { BOX, mat } from '@/scenes/neighbourhood/shared3d'

/**
 * A believable walking person, built from smooth tapered limbs: shoulders, elbows, knees, hands, shoes, a face with
 * eyes and a nose, hair, and clothes people actually wear here (shirt and trousers, kurta, veshti, saree).
 * One unit is about 0.57 m, so a standing figure is about 3 units tall and fits the walk-in store.
 */

export type Outfit = 'shirt' | 'kurta' | 'veshti' | 'saree'

export interface Look {
  outfit: Outfit
  skin: string
  hair: string
  top: string
  bottom: string
  accent: string
  /** Long hair (plait) rather than short. */
  long: boolean
  /** Carries a hand basket. */
  basket: boolean
  height: number
}

const SKINS = ['#f0c8a0', '#d9a273', '#c28a5c', '#a2673f', '#7a4a2c']
const HAIRS = ['#15100c', '#1d1510', '#2a1d14', '#6f6b66', '#0e0b09']
const SHIRTS = ['#e8e4d8', '#3b6fa8', '#8aa0b8', '#c8553d', '#4a7a5a', '#d8b04a', '#6a5aa0']
const KURTAS = ['#f0e6d0', '#2f7a6a', '#c4322a', '#d89a2a', '#4a6aa8']
const SAREES = ['#c4322a', '#2f7a6a', '#d89a2a', '#6a3a8a', '#c4467a', '#2a5a9a', '#3f7a3a']
const TROUSERS = ['#25303d', '#3d3a34', '#5a5448', '#2f3a52']

/** A repeatable, varied cast of shoppers. */
export function lookFor(i: number): Look {
  const kind: Outfit[] = ['saree', 'shirt', 'kurta', 'saree', 'veshti', 'shirt', 'kurta', 'saree']
  const outfit = kind[i % kind.length]
  const woman = outfit === 'saree' || (outfit === 'kurta' && i % 2 === 1)
  const pick = <T,>(a: T[], n: number) => a[(i * 7 + n * 3) % a.length]
  return {
    outfit,
    skin: pick(SKINS, 1),
    hair: pick(HAIRS, 2),
    top: outfit === 'saree' ? pick(SAREES, 3) : outfit === 'kurta' ? pick(KURTAS, 3) : pick(SHIRTS, 3),
    bottom: outfit === 'veshti' ? '#f4efe4' : outfit === 'kurta' && woman ? pick(SAREES, 5) : pick(TROUSERS, 4),
    accent: pick(SAREES, 6),
    long: woman,
    basket: i % 2 === 0,
    height: 0.95 + ((i * 13) % 10) / 100 + (woman ? -0.03 : 0.02),
  }
}

const cache = new Map<string, BufferGeometry>()
const memo = (key: string, make: () => BufferGeometry) => {
  let g = cache.get(key)
  if (!g) {
    g = make()
    cache.set(key, g)
  }
  return g
}
const capsule = (r: number, len: number) => memo(`c${r}-${len}`, () => new CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 5, 12))
const ball = () => memo('ball', () => new SphereGeometry(1, 18, 14))
const hairCap = () => memo('hair', () => new SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62))
const skirt = (rTop: number, rBot: number, h: number) => memo(`s${rTop}-${rBot}-${h}`, () => new CylinderGeometry(rTop, rBot, h, 20, 1, true))
const cone = () => memo('cone', () => new ConeGeometry(1, 1, 8))

const m = (c: string, o?: Parameters<typeof mat>[1]): MeshStandardMaterial => mat(c, { roughness: 0.82, metalness: 0, ...o })

export interface Gait {
  /** Distance-driven phase (radians). */
  phase: number
  /** 0 when standing, 1 at a normal stroll. */
  speed: number
  /** Seconds, for idle motion. */
  time: number
}

export function Human({ look, gait }: { look: Look; gait: React.MutableRefObject<Gait> }) {
  const root = useRef<Group>(null)
  const legL = useRef<Group>(null)
  const legR = useRef<Group>(null)
  const kneeL = useRef<Group>(null)
  const kneeR = useRef<Group>(null)
  const armL = useRef<Group>(null)
  const armR = useRef<Group>(null)
  const elbL = useRef<Group>(null)
  const elbR = useRef<Group>(null)
  const torso = useRef<Group>(null)
  const head = useRef<Group>(null)

  const mats = useMemo(
    () => ({
      skin: m(look.skin, { roughness: 0.7 }),
      hair: m(look.hair, { roughness: 0.55 }),
      top: m(look.top),
      bottom: m(look.bottom),
      accent: m(look.accent),
      shoe: m('#2a211c', { roughness: 0.6 }),
      dark: m('#15100c'),
      basket: m('#d94f2b'),
    }),
    [look],
  )

  useFrame(() => {
    const g = gait.current
    const walk = Math.min(1, g.speed)
    const s = Math.sin(g.phase)
    const c = Math.cos(g.phase)
    const swing = 0.62 * walk
    if (legL.current) legL.current.rotation.x = s * swing
    if (legR.current) legR.current.rotation.x = -s * swing
    if (kneeL.current) kneeL.current.rotation.x = Math.max(0, -c * 0.9 * walk) + 0.04
    if (kneeR.current) kneeR.current.rotation.x = Math.max(0, c * 0.9 * walk) + 0.04
    // arms swing against the legs; the basket arm (right) holds still
    const carry = look.basket
    if (armL.current) armL.current.rotation.x = -s * 0.5 * walk + 0.04
    if (armR.current) armR.current.rotation.x = carry ? -0.25 - s * 0.05 * walk : s * 0.5 * walk + 0.04
    if (elbL.current) elbL.current.rotation.x = -0.18 - Math.max(0, s) * 0.45 * walk
    if (elbR.current) elbR.current.rotation.x = carry ? -0.5 : -0.18 - Math.max(0, -s) * 0.45 * walk
    if (torso.current) {
      torso.current.rotation.y = s * 0.12 * walk
      torso.current.rotation.z = c * 0.025 * walk
      torso.current.rotation.x = 0.03 + 0.02 * walk
    }
    if (root.current) root.current.position.y = Math.abs(c) * 0.05 * walk * look.height + Math.sin(g.time * 1.4) * 0.004
    // the head looks around when they slow down to browse
    if (head.current) {
      head.current.rotation.y = Math.sin(g.time * 0.9 + look.height * 9) * (0.15 + 0.6 * (1 - walk))
      head.current.rotation.x = Math.sin(g.time * 0.6) * 0.06 * (1 - walk) - 0.02
    }
  })

  const woman = look.outfit === 'saree' || look.long
  const shoulderW = woman ? 0.29 : 0.34
  const hipY = 1.52
  const sleeveLen = look.outfit === 'saree' ? 0.22 : 0.52
  return (
    <group scale={look.height}>
      <group ref={root}>
        {/* legs */}
        {[-1, 1].map((side) => {
          const hip = side < 0 ? legL : legR
          const knee = side < 0 ? kneeL : kneeR
          const covered = look.outfit === 'saree' || look.outfit === 'veshti'
          return (
            <group key={side} ref={hip} position={[side * 0.12, hipY, 0]}>
              <mesh geometry={capsule(0.105, 0.78)} material={covered ? mats.bottom : mats.bottom} position={[0, -0.36, 0]} />
              <group ref={knee} position={[0, -0.72, 0]}>
                <mesh geometry={capsule(0.082, 0.76)} material={look.outfit === 'veshti' || look.outfit === 'saree' ? mats.skin : mats.bottom} position={[0, -0.34, 0]} />
                <mesh geometry={BOX} material={mats.shoe} position={[0, -0.7, 0.07]} scale={[0.15, 0.1, 0.34]} />
              </group>
            </group>
          )
        })}

        {/* saree / veshti drape hides the legs down to the ankle */}
        {look.outfit === 'saree' && <mesh geometry={skirt(0.2, 0.3, 1.35)} material={mats.top} position={[0, hipY - 0.55, 0]} />}
        {look.outfit === 'veshti' && <mesh geometry={skirt(0.22, 0.27, 1.2)} material={mats.bottom} position={[0, hipY - 0.45, 0]} />}
        {look.outfit === 'kurta' && <mesh geometry={skirt(0.22, 0.28, 0.78)} material={mats.top} position={[0, hipY - 0.1, 0]} />}

        {/* pelvis */}
        <mesh geometry={ball()} material={look.outfit === 'saree' ? mats.top : mats.bottom} position={[0, hipY + 0.02, 0]} scale={[0.22, 0.14, 0.15]} />

        <group ref={torso} position={[0, hipY, 0]}>
          {/* torso, tapering to the waist */}
          <mesh geometry={capsule(0.17, 0.78)} material={mats.top} position={[0, 0.46, 0]} scale={[woman ? 1.28 : 1.45, 1, 0.78]} />
          <mesh geometry={ball()} material={mats.top} position={[0, 0.88, 0]} scale={[shoulderW + 0.02, 0.12, 0.17]} />
          {look.outfit === 'saree' && <mesh geometry={BOX} material={mats.accent} position={[-0.18, 0.55, 0.01]} rotation={[0, 0, -0.5]} scale={[0.12, 0.95, 0.3]} />}
          {/* neck and head */}
          <mesh geometry={capsule(0.058, 0.2)} material={mats.skin} position={[0, 1.0, 0]} />
          <group ref={head} position={[0, 1.2, 0]}>
            <mesh geometry={ball()} material={mats.skin} scale={[0.16, 0.2, 0.18]} />
            <mesh geometry={hairCap()} material={mats.hair} position={[0, 0.02, -0.015]} scale={[0.172, 0.215, 0.195]} rotation={[-0.25, 0, 0]} />
            {look.long && <mesh geometry={capsule(0.05, 0.6)} material={mats.hair} position={[0, -0.28, -0.16]} rotation={[0.08, 0, 0]} />}
            {/* ears, nose, eyes, brows */}
            {[-1, 1].map((s) => (
              <group key={s}>
                <mesh geometry={ball()} material={mats.skin} position={[s * 0.16, -0.01, 0]} scale={[0.025, 0.045, 0.03]} />
                <mesh geometry={ball()} material={mats.dark} position={[s * 0.062, 0.025, 0.165]} scale={[0.02, 0.016, 0.012]} />
                <mesh geometry={BOX} material={mats.hair} position={[s * 0.062, 0.062, 0.163]} scale={[0.07, 0.012, 0.012]} />
              </group>
            ))}
            <mesh geometry={cone()} material={mats.skin} position={[0, -0.02, 0.185]} rotation={[Math.PI / 2.2, 0, 0]} scale={[0.028, 0.06, 0.028]} />
            {look.outfit === 'saree' && <mesh geometry={ball()} material={mats.accent} position={[0, 0.07, 0.17]} scale={[0.012, 0.012, 0.006]} />}
          </group>

          {/* arms */}
          {[-1, 1].map((side) => {
            const arm = side < 0 ? armL : armR
            const elbow = side < 0 ? elbL : elbR
            return (
              <group key={side} ref={arm} position={[side * shoulderW, 0.84, 0]}>
                <mesh geometry={ball()} material={mats.top} scale={[0.085, 0.085, 0.085]} />
                <mesh geometry={capsule(0.066, 0.58)} material={look.outfit === 'saree' ? mats.top : mats.top} position={[0, -0.27, 0]} />
                {sleeveLen < 0.4 && <mesh geometry={capsule(0.062, 0.34)} material={mats.skin} position={[0, -0.36, 0]} />}
                <group ref={elbow} position={[0, -0.55, 0]}>
                  <mesh geometry={capsule(0.054, 0.55)} material={mats.skin} position={[0, -0.24, 0]} />
                  <mesh geometry={ball()} material={mats.skin} position={[0, -0.54, 0]} scale={[0.058, 0.07, 0.04]} />
                  {look.basket && side > 0 && (
                    <group position={[0.02, -0.66, 0.06]}>
                      <mesh geometry={BOX} material={mats.basket} position={[0, 0, 0]} scale={[0.46, 0.26, 0.3]} />
                      <mesh geometry={BOX} material={mats.dark} position={[0, 0.17, 0]} scale={[0.46, 0.02, 0.03]} />
                    </group>
                  )}
                </group>
              </group>
            )
          })}
        </group>
      </group>
    </group>
  )
}
