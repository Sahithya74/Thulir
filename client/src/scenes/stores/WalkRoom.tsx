import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, DoubleSide, InstancedMesh, MathUtils, MeshStandardMaterial, Object3D, RepeatWrapping, SphereGeometry, type Group, type Mesh } from 'three'
import { DEPARTMENT_LABEL, type Localised } from '@thulir/shared'
import { BOX, CYL, PLANE, mat } from '@/scenes/neighbourhood/shared3d'
import { floorTexture, signTexture } from './packTexture'
import { AISLE, EYE_Y, GONDOLA_HALF_DEPTH, LEVEL_Y, WALL_H, type Face, type WalkPlan } from './walkLayout'
import type { StoreTheme } from './themes'

const glow = (color: string, i = 1.4) => mat(color, { emissive: color, emissiveIntensity: i, roughness: 0.5 })

/** Floor, walls, ceiling, lights, entrance, checkouts and the shop's name board. */
export function WalkRoom({ plan, theme, storeName, reducedMotion }: { plan: WalkPlan; theme: StoreTheme; storeName: Localised; reducedMotion: boolean }) {
  const { width: W, depth: D } = plan
  const floorMat = useMemo(() => {
    const t = floorTexture(theme.fixture === 'pantry' || theme.fixture === 'counter' ? 'wood' : theme.fixture === 'chilled' ? 'white' : 'checker', theme.floor, theme.floorB)
    t.wrapS = t.wrapT = RepeatWrapping
    const tex = t.clone()
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.repeat.set(W / 5, D / 5)
    tex.needsUpdate = true
    return new MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0.08 })
  }, [theme, W, D])
  useEffect(() => () => floorMat.map?.dispose(), [floorMat])

  const nameSign = useMemo(() => signTexture(storeName, theme.trim, '#ffffff'), [storeName, theme.trim])
  const nameMat = useMemo(() => new MeshStandardMaterial({ map: nameSign, emissive: '#ffffff', emissiveMap: nameSign, emissiveIntensity: 0.35, roughness: 0.5 }), [nameSign])
  useEffect(() => () => nameMat.dispose(), [nameMat])

  const lightRows = Math.max(2, Math.round(D / 7))
  const lightCols = Math.max(3, Math.round(W / 7))

  return (
    <group>
      {/* floor with a soft walkway down the middle */}
      <mesh geometry={PLANE} material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, D / 2]} scale={[W, D, 1]} />
      <mesh geometry={PLANE} material={mat(theme.accent, { transparent: true, opacity: 0.16 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, D / 2 - 2]} scale={[5, D - 2, 1]} />

      {/* walls */}
      <mesh geometry={BOX} material={mat(theme.wall)} position={[0, WALL_H / 2, -0.3]} scale={[W + 0.6, WALL_H, 0.6]} />
      <mesh geometry={BOX} material={mat(theme.wall)} position={[-W / 2 - 0.3, WALL_H / 2, D / 2]} scale={[0.6, WALL_H, D + 0.6]} />
      <mesh geometry={BOX} material={mat(theme.wall)} position={[W / 2 + 0.3, WALL_H / 2, D / 2]} scale={[0.6, WALL_H, D + 0.6]} />
      {/* wainscot and skirting */}
      <mesh geometry={BOX} material={mat(theme.trim)} position={[0, 0.25, 0.05]} scale={[W, 0.5, 0.12]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={mat(theme.trim)} position={[(s * W) / 2 - s * 0.05, 0.25, D / 2]} scale={[0.12, 0.5, D]} />
      ))}
      {/* front wall either side of the entrance, with a big shop window */}
      {[-1, 1].map((s) => {
        const half = (W - plan.door.w) / 2
        return (
          <group key={s} position={[(s * (plan.door.w + half)) / 2 + (s * 0), 0, D + 0.3]}>
            <mesh geometry={BOX} material={mat(theme.wall)} position={[0, WALL_H / 2, 0]} scale={[half, WALL_H, 0.6]} />
            <mesh geometry={BOX} material={mat('#bfe7ff', { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 })} position={[0, 3.6, -0.2]} scale={[half - 1.6, 4.6, 0.06]} raycast={() => null} />
          </group>
        )
      })}
      <mesh geometry={BOX} material={mat(theme.wall)} position={[0, WALL_H - 1.2, D + 0.3]} scale={[plan.door.w + 0.4, 2.4, 0.6]} />

      {/* shop name board above the back wall */}
      <mesh geometry={PLANE} material={nameMat} position={[0, WALL_H - 1.5, 0.13]} scale={[Math.min(W * 0.46, 13), Math.min(W * 0.46, 13) / 4, 1]} />
      <mesh geometry={BOX} material={mat(theme.accent)} position={[0, WALL_H - 2.9, 0.1]} scale={[W, 0.16, 0.08]} />

      {/* ceiling with light panels (emissive, so there is no light-count cost) */}
      <mesh geometry={PLANE} material={mat('#f7fbff', { roughness: 0.95, side: DoubleSide })} rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, D / 2]} scale={[W, D, 1]} />
      {Array.from({ length: lightRows }, (_, r) =>
        Array.from({ length: lightCols }, (_, c) => (
          <mesh key={`${r}-${c}`} geometry={BOX} material={glow('#fffbf2', 1.7)} position={[(c - (lightCols - 1) / 2) * (W / lightCols), WALL_H - 0.08, 3 + r * ((D - 5) / lightRows)]} scale={[3.8, 0.1, 0.55]} />
        )),
      )}

      <Entrance plan={plan} theme={theme} reducedMotion={reducedMotion} />
      {plan.counters.map((c, i) => (
        <Checkout key={i} x={c.x} z={c.z} theme={theme} index={i} reducedMotion={reducedMotion} />
      ))}
      <Trolleys x={plan.door.w / 2 + 3.2} z={D - 2.2} theme={theme} />
      <BasketStack x={-plan.door.w / 2 - 3} z={D - 1.6} />
      {plan.fixtures.map((f, i) => (
        <ProduceIsland key={i} x={f.x} z={f.z} w={f.w} d={f.d} theme={theme} seed={i + 1} />
      ))}
      <Ducting W={W} D={D} />
    </group>
  )
}

const HEAP = new SphereGeometry(1, 10, 8)
const PRODUCE_SETS = [
  ['#d9402e', '#c4322a', '#e4573a'],
  ['#f08a24', '#e87a1c', '#f5a23c'],
  ['#5a9a2e', '#4a8a28', '#6aa83a'],
  ['#f1cf3b', '#e6bf2a', '#f6dd5a'],
  ['#8a2a46', '#7a2240', '#a03a58'],
  ['#e8b13a', '#d89a2c', '#f0c350'],
]

/** A heap of loose fruit or vegetables, as one instanced mesh. */
function Heap({ colors, seed, x, y, z }: { colors: string[]; seed: number; x: number; y: number; z: number }) {
  const ref = useRef<InstancedMesh>(null)
  const N = 34
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    const c = new Color()
    let r = seed * 9301 + 49297
    const rnd = () => {
      r = (r * 9301 + 49297) % 233280
      return r / 233280
    }
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2
      const rad = Math.sqrt(rnd()) * 0.72
      const hgt = (1 - rad / 0.8) * 0.34
      const s = 0.2 + rnd() * 0.07
      o.position.set(Math.cos(a) * rad * 1.15, hgt + rnd() * 0.05, Math.sin(a) * rad * 1.0)
      o.scale.set(s, s * (0.85 + rnd() * 0.2), s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(colors[Math.floor(rnd() * colors.length)]))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [colors, seed])
  return (
    <instancedMesh ref={ref} args={[HEAP, undefined as never, N]} position={[x, y, z]} raycast={() => null}>
      <meshStandardMaterial roughness={0.55} />
    </instancedMesh>
  )
}

/** An open produce table: wooden crates of fruit and vegetables under a hanging sign. */
function ProduceIsland({ x, z, w, d, theme, seed }: { x: number; z: number; w: number; d: number; theme: StoreTheme; seed: number }) {
  const sign = useMemo(() => signTexture({ en: 'Fresh produce', ta: 'புதிய காய்கறி, பழங்கள்' }, theme.accent, '#ffffff'), [theme.accent])
  const signMat = useMemo(() => new MeshStandardMaterial({ map: sign, emissive: '#ffffff', emissiveMap: sign, emissiveIntensity: 0.4, roughness: 0.6 }), [sign])
  useEffect(() => () => signMat.dispose(), [signMat])
  const crates = [-1, 0, 1]
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={BOX} material={mat('#8a5a3c', { roughness: 0.8 })} position={[0, 0.55, 0]} scale={[w, 1.1, d]} />
      <mesh geometry={BOX} material={mat('#5a3a22')} position={[0, 0.08, 0]} scale={[w + 0.2, 0.16, d + 0.2]} />
      {crates.map((c, i) => (
        <group key={c} position={[c * (w / 3), 1.1, 0]}>
          <mesh geometry={BOX} material={mat('#c99a5c', { roughness: 0.85 })} position={[0, 0.2, 0]} scale={[w / 3 - 0.25, 0.4, d - 0.35]} />
          <Heap colors={PRODUCE_SETS[(seed * 2 + i) % PRODUCE_SETS.length]} seed={seed * 10 + i} x={0} y={0.4} z={0} />
        </group>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={CYL} material={mat('#3a2a20')} position={[(s * w) / 2.2, 3.6, 0]} scale={[0.07, 5.2, 0.07]} />
      ))}
      <mesh geometry={PLANE} material={signMat} position={[0, 5.4, 0]} scale={[Math.min(w * 0.95, 5.6), 1.4, 1]} />
      <mesh geometry={PLANE} material={signMat} position={[0, 5.4, 0.01]} rotation={[0, Math.PI, 0]} scale={[Math.min(w * 0.95, 5.6), 1.4, 1]} />
    </group>
  )
}

/** Hand baskets stacked by the door. */
function BasketStack({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={BOX} material={mat('#3a2a20')} position={[0, 0.5, 0]} scale={[1.5, 1, 1.1]} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={BOX} material={mat(i % 2 ? '#d94f2b' : '#c4402a', { roughness: 0.6 })} position={[0, 1.15 + i * 0.28, 0]} scale={[1.3, 0.3, 0.95]} />
      ))}
    </group>
  )
}

/** Air-conditioning ducts and cable trays under the ceiling: the clutter that makes a roof read as a roof. */
function Ducting({ W, D }: { W: number; D: number }) {
  return (
    <group>
      {[0.28, 0.62].map((t) => (
        <group key={t} position={[0, WALL_H - 0.9, D * t]}>
          <mesh geometry={BOX} material={mat('#c5ced8', { metalness: 0.5, roughness: 0.45 })} scale={[W - 1, 0.7, 0.9]} />
          {Array.from({ length: Math.round(W / 6) }, (_, i) => (
            <mesh key={i} geometry={BOX} material={mat('#9aa6b4', { metalness: 0.5, roughness: 0.4 })} position={[(i - (Math.round(W / 6) - 1) / 2) * 6, 0, 0]} scale={[0.14, 0.78, 1]} />
          ))}
        </group>
      ))}
      <mesh geometry={BOX} material={mat('#8a96a4', { metalness: 0.6, roughness: 0.4 })} position={[0, WALL_H - 0.4, D * 0.45]} scale={[W - 1, 0.12, 0.7]} />
    </group>
  )
}

/** Sliding glass doors that part as the shopper approaches. */
function Entrance({ plan, theme, reducedMotion }: { plan: WalkPlan; theme: StoreTheme; reducedMotion: boolean }) {
  const left = useRef<Mesh>(null)
  const right = useRef<Mesh>(null)
  const open = useRef(0)
  const camera = useThree((s) => s.camera)
  const { w } = plan.door
  useFrame((_, dt) => {
    const near = Math.hypot(camera.position.x - plan.door.x, camera.position.z - plan.door.z) < 9 ? 1 : 0
    open.current = MathUtils.damp(open.current, reducedMotion ? 1 : near, 4, dt)
    const o = open.current * (w / 2 - 0.2)
    if (left.current) left.current.position.x = -w / 4 - o
    if (right.current) right.current.position.x = w / 4 + o
  })
  return (
    <group position={[plan.door.x, 0, plan.door.z + 0.15]}>
      <mesh ref={left} geometry={BOX} material={mat('#bfe7ff', { transparent: true, opacity: 0.32, roughness: 0.05 })} position={[-w / 4, 3.4, 0]} scale={[w / 2 - 0.15, 6.8, 0.08]} raycast={() => null} />
      <mesh ref={right} geometry={BOX} material={mat('#bfe7ff', { transparent: true, opacity: 0.32, roughness: 0.05 })} position={[w / 4, 3.4, 0]} scale={[w / 2 - 0.15, 6.8, 0.08]} raycast={() => null} />
      <mesh geometry={BOX} material={mat(theme.trim)} position={[0, 6.85, 0]} scale={[w + 0.4, 0.3, 0.3]} />
      <mesh geometry={PLANE} material={mat(theme.accent)} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -1.6]} scale={[w - 1, 2.4, 1]} />
    </group>
  )
}

function Checkout({ x, z, theme, index, reducedMotion }: { x: number; z: number; theme: StoreTheme; index: number; reducedMotion: boolean }) {
  const cashier = useRef<Group>(null)
  const screen = useRef<MeshStandardMaterial>(null)
  const belt = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (reducedMotion) return
    const t = clock.elapsedTime + index * 1.7
    if (cashier.current) {
      cashier.current.position.y = Math.sin(t * 1.3) * 0.03
      cashier.current.rotation.y = Math.sin(t * 0.5) * 0.25
      cashier.current.children[1].rotation.x = -0.4 + Math.sin(t * 2.2) * 0.25
    }
    if (screen.current) screen.current.emissiveIntensity = 0.9 + Math.sin(t * 6) * 0.2
    if (belt.current) belt.current.position.x = ((t * 0.6) % 1.6) - 0.8
  })
  return (
    <group position={[x, 0, z]}>
      {/* counter */}
      <mesh geometry={BOX} material={mat(theme.trim)} position={[0, 0.9, 0]} scale={[5.6, 1.8, 1.9]} />
      <mesh geometry={BOX} material={mat('#fff6e5', { roughness: 0.3 })} position={[0, 1.84, 0]} scale={[5.7, 0.12, 2.0]} />
      <mesh geometry={BOX} material={mat(theme.accent)} position={[0, 1.0, 0.97]} scale={[5.6, 0.4, 0.05]} />
      {/* belt with a few items sliding along */}
      <mesh geometry={BOX} material={mat('#2a3340')} position={[-0.6, 1.93, 0.1]} scale={[3.2, 0.05, 1.1]} />
      <group ref={belt} position={[0, 2.2, 0.1]}>
        <mesh geometry={BOX} material={mat('#d94f2b')} position={[-0.7, 0, 0]} scale={[0.4, 0.5, 0.3]} />
        <mesh geometry={BOX} material={mat('#f5b82e')} position={[0.1, -0.05, 0.1]} scale={[0.5, 0.4, 0.3]} />
        <mesh geometry={CYL} material={mat('#3f7a3a')} position={[0.9, -0.02, -0.1]} scale={[0.22, 0.5, 0.22]} />
      </group>
      {/* till screen */}
      <mesh geometry={BOX} material={mat('#10161d')} position={[1.9, 2.25, 0.2]} rotation={[-0.3, 0, 0]} scale={[0.9, 0.6, 0.08]} />
      <mesh geometry={PLANE} position={[1.9, 2.25, 0.25]} rotation={[-0.3, 0, 0]} scale={[0.8, 0.5, 1]}>
        <meshStandardMaterial ref={screen} color="#9be8ff" emissive="#7fd3ff" emissiveIntensity={1} />
      </mesh>
      {/* cashier */}
      <group ref={cashier} position={[1.2, 0, -1.7]}>
        <mesh geometry={CYL} material={mat(index ? '#d94f2b' : '#3f7a3a')} position={[0, 2.35, 0]} scale={[0.5, 1.5, 0.4]} />
        <mesh geometry={BOX} material={mat('#8a5a3c')} position={[0.4, 2.5, 0.35]} scale={[0.18, 0.7, 0.18]} />
        <mesh geometry={CYL} material={mat('#8a5a3c')} position={[0, 3.45, 0]} scale={[0.34, 0.42, 0.34]} />
        <mesh geometry={CYL} material={mat('#3a2a20')} position={[0, 3.62, 0]} scale={[0.36, 0.14, 0.36]} />
      </group>
      {/* lane sign */}
      <mesh geometry={BOX} material={glow(theme.accent, 1)} position={[0, 5.5, 0]} scale={[2.2, 0.8, 0.12]} />
      <mesh geometry={CYL} material={mat('#8f9aa8')} position={[0, 7.4, 0]} scale={[0.05, 3.8, 0.05]} />
    </group>
  )
}

function Trolleys({ x, z, theme }: { x: number; z: number; theme: StoreTheme }) {
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2].map((i) => (
        <group key={i} position={[i * 0.5, 0, i * -0.18]}>
          <mesh geometry={BOX} material={mat('#c5ced8', { metalness: 0.7, roughness: 0.3 })} position={[0, 1.2, 0]} scale={[1.3, 0.75, 0.8]} />
          <mesh geometry={BOX} material={mat(theme.accent)} position={[0, 1.65, 0.45]} scale={[1.3, 0.1, 0.08]} />
          <mesh geometry={BOX} material={mat('#3a2a20')} position={[0, 0.5, 0]} scale={[1.0, 0.1, 0.7]} />
        </group>
      ))}
    </group>
  )
}

function joinLabels(list: Localised[]): Localised {
  const use = list.slice(0, 2)
  return { en: use.map((l) => l.en).join(' · '), ta: use.map((l) => l.ta).join(' · ') }
}

/** Hanging department boards over each aisle end and wall run, so the shopper always knows where they are. */
export function AisleSigns({ plan, theme, labels }: { plan: WalkPlan; theme: StoreTheme; labels?: Partial<Record<string, Localised>> }) {
  const items: { face: Face; x: number; z: number; rotY: number; wall: boolean }[] = []
  for (const f of plan.faces) {
    if (f.kind === 'wall') items.push({ face: f, x: f.x, z: f.z, rotY: 0, wall: true })
    else items.push({ face: f, x: f.x - (f.length / 2 - 3.4) * Math.cos(f.rotY), z: f.z, rotY: f.rotY, wall: false })
  }
  return (
    <group>
      {items.map(({ face, x, z, rotY, wall }) => (
        <DeptSign key={face.index} label={joinLabels(face.depts.map((d) => labels?.[d] ?? DEPARTMENT_LABEL[d]))} x={x} z={z} rotY={rotY} y={wall ? 6.4 : 7.15} wall={wall} theme={theme} index={face.index} />
      ))}
    </group>
  )
}

function DeptSign({ label, x, z, rotY, y, wall, theme, index }: { label: Localised; x: number; z: number; rotY: number; y: number; wall: boolean; theme: StoreTheme; index: number }) {
  const tex = useMemo(() => signTexture(label, index % 2 ? theme.accent : theme.trim, '#ffffff'), [label, theme, index])
  const m = useMemo(() => new MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.3, roughness: 0.6 }), [tex])
  const g = useRef<Group>(null)
  useEffect(() => () => m.dispose(), [m])
  useFrame(({ clock }) => {
    if (!wall && g.current) g.current.rotation.z = Math.sin(clock.elapsedTime * 0.8 + index) * 0.012
  })
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      <group ref={g}>
        {!wall && (
          <>
            <mesh geometry={CYL} material={mat('#8f9aa8')} position={[-2.6, 1.05, 0]} scale={[0.03, 2.1, 0.03]} />
            <mesh geometry={CYL} material={mat('#8f9aa8')} position={[2.6, 1.05, 0]} scale={[0.03, 2.1, 0.03]} />
          </>
        )}
        <mesh geometry={PLANE} material={m} position={[0, 0, wall ? 0.15 : 0.6]} scale={[6, 1.5, 1]} />
        {!wall && <mesh geometry={PLANE} material={m} position={[0, 0, -0.6]} rotation={[0, Math.PI, 0]} scale={[6, 1.5, 1]} />}
      </group>
    </group>
  )
}

/** One shelf face: boards, uprights, back panel, header and (for chillers) a glass front. Products are drawn by the caller. */
export function Bay({ face, theme }: { face: Face; theme: StoreTheme }) {
  const f = theme.fixture
  const len = face.length
  const top = LEVEL_Y[0] + 2.0
  const boardMat = mat(theme.shelf, { roughness: f === 'rack' || f === 'chilled' ? 0.3 : 0.75, metalness: f === 'rack' ? 0.35 : 0.05 })
  const back = f === 'chilled' ? '#dcebf0' : f === 'pantry' ? '#7a5030' : f === 'market' ? '#9a7550' : theme.wall
  return (
    <group>
      {face.kind === 'wall' && <mesh geometry={BOX} material={mat(back, { roughness: 0.9 })} position={[0, top / 2 + 0.3, -0.55]} scale={[len, top + 0.6, 0.12]} />}
      {LEVEL_Y.map((y) => (
        <mesh key={y} geometry={BOX} material={boardMat} position={[0, y - 0.07, 0.0]} scale={[len, 0.14, 1.24]} />
      ))}
      {[-len / 2, len / 2].map((x) => (
        <mesh key={x} geometry={BOX} material={mat(theme.trim)} position={[x, top / 2, 0.0]} scale={[0.16, top, 1.24]} />
      ))}
      <mesh geometry={BOX} material={mat(theme.trim)} position={[0, top + 0.1, 0.05]} scale={[len + 0.3, 0.22, 1.35]} />
      <mesh geometry={BOX} material={mat(theme.accent)} position={[0, top + 0.1, 0.74]} scale={[len + 0.3, 0.1, 0.05]} />
      {f === 'chilled' && (
        <>
          <mesh geometry={BOX} material={mat('#cfe9f3', { transparent: true, opacity: 0.13, roughness: 0.05 })} position={[0, top / 2 + 0.1, 0.9]} scale={[len, top - 0.2, 0.04]} raycast={() => null} />
          <mesh geometry={BOX} material={glow('#cdeeff', 1.8)} position={[0, top - 0.05, 0.4]} scale={[len - 0.4, 0.05, 0.1]} />
        </>
      )}
      {f === 'counter' && <mesh geometry={BOX} material={glow('#ffd9a0', 1.6)} position={[0, top - 0.05, 0.45]} scale={[len - 0.4, 0.05, 0.12]} />}
    </group>
  )
}

/** Gondola spine and end caps (the two faces are drawn separately as Bay). */
export function GondolaFrame({ x, z, length, theme }: { x: number; z: number; length: number; theme: StoreTheme }) {
  const top = LEVEL_Y[0] + 2.0
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={BOX} material={mat(theme.shelf, { roughness: 0.8 })} position={[0, top / 2, 0]} scale={[length - 0.4, top, 0.14]} />
      <mesh geometry={BOX} material={mat(theme.trim)} position={[0, 0.22, 0]} scale={[length, 0.44, GONDOLA_HALF_DEPTH * 2 - 0.1]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={mat(theme.accent)} position={[(s * length) / 2, top / 2, 0]} scale={[0.1, top, GONDOLA_HALF_DEPTH * 2]} />
      ))}
    </group>
  )
}

export const WALK_EYE = EYE_Y
export const WALK_AISLE = AISLE
