import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { MathUtils, MeshStandardMaterial, type Group, type Texture } from 'three'
import type { Store } from '@thulir/shared'
import { C, CAT_COLOR, makeFacadeTexture, makeNameBoard } from './palette'
import { useLang } from '@/services/i18n'
import { BOX, CYL, PLANE, glassMat, mat } from './shared3d'
import type { Plot } from './layout'

interface Props {
  plot: Plot
  store: Store
  hovered: boolean
  selected: boolean
  dimmed: boolean
  shadows: boolean
  reducedMotion: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

interface Theme {
  wall: string
  band: string
  awningA: string
  awningB: string
  glassGlow: number
}

const THEMES: Record<Plot['category'], Theme> = {
  supermarket: { wall: '#f4f9fd', band: CAT_COLOR.supermarket, awningA: CAT_COLOR.supermarket, awningB: '#ffffff', glassGlow: 0.6 },
  provision: { wall: '#ffe3ba', band: CAT_COLOR.provision, awningA: CAT_COLOR.provision, awningB: '#fff4e0', glassGlow: 0.5 },
  fruit_veg: { wall: '#e1f4d3', band: CAT_COLOR.fruit_veg, awningA: CAT_COLOR.fruit_veg, awningB: '#ffffff', glassGlow: 0.3 },
  bakery: { wall: '#ffe9ef', band: CAT_COLOR.bakery, awningA: CAT_COLOR.bakery, awningB: '#ffffff', glassGlow: 0.75 },
  dairy: { wall: '#e7f5ff', band: CAT_COLOR.dairy, awningA: CAT_COLOR.dairy, awningB: '#ffffff', glassGlow: 0.55 },
  household: { wall: '#eaedff', band: CAT_COLOR.household, awningA: CAT_COLOR.household, awningB: '#ffffff', glassGlow: 0.5 },
}

const GF = 3.4 // ground-floor height

function Awning({ w, z, theme, reducedMotion }: { w: number; z: number; theme: Theme; reducedMotion: boolean }) {
  const ref = useRef<Group>(null)
  const slats = Math.max(4, Math.round(w))
  const sw = (w - 0.6) / slats
  useFrame(({ clock }) => {
    if (reducedMotion || !ref.current) return
    ref.current.rotation.x = 0.22 + Math.sin(clock.elapsedTime * 0.9) * 0.008
  })
  return (
    <group ref={ref} position={[0, GF + 0.15, z]} rotation={[0.22, 0, 0]}>
      {Array.from({ length: slats }, (_, i) => (
        <mesh
          key={i}
          geometry={BOX}
          material={mat(i % 2 ? theme.awningB : theme.awningA)}
          position={[-(w - 0.6) / 2 + sw * (i + 0.5), 0, 0.8]}
          scale={[sw, 0.1, 1.7]}
          castShadow
        />
      ))}
    </group>
  )
}

function Shopfront({ w, d, theme, glowOverride }: { w: number; d: number; theme: Theme; glowOverride?: number }) {
  const glow = glowOverride ?? theme.glassGlow
  return (
    <group position={[0, 0, d / 2]}>
      <mesh geometry={BOX} material={mat(C.charcoal)} position={[0, GF / 2, 0.04]} scale={[w - 0.5, GF - 0.2, 0.1]} />
      <mesh geometry={BOX} material={glassMat(glow)} position={[0, GF / 2 + 0.05, 0.12]} scale={[w - 1.1, GF - 0.9, 0.05]} />
      {/* entrance */}
      <mesh geometry={BOX} material={mat('#f5e6c8', { emissive: '#ffd9a0', emissiveIntensity: 0.55 })} position={[w * 0.18, 1.35, 0.16]} scale={[1.3, 2.5, 0.04]} />
      {/* fascia sign band */}
      <mesh geometry={BOX} material={mat(theme.band)} position={[0, GF + 0.75, 0.12]} scale={[w - 0.5, 0.95, 0.22]} castShadow />
    </group>
  )
}

function RoofKit({ w, d, h, seed }: { w: number; d: number; h: number; seed: number }) {
  const tankX = (seed % 2 ? -1 : 1) * (w / 2 - 1.3)
  return (
    <group position={[0, h, 0]}>
      <mesh geometry={BOX} material={mat('#d9d4c4')} position={[0, 0.17, 0]} scale={[w + 0.25, 0.34, d + 0.25]} castShadow />
      {/* water tank on a stand, a familiar town-centre rooftop detail */}
      <mesh geometry={CYL} material={mat('#3b3f3b')} position={[tankX, 1.45, -d / 4]} scale={[0.75, 1.2, 0.75]} castShadow />
      <mesh geometry={BOX} material={mat('#8a8d86')} position={[tankX, 0.7, -d / 4]} scale={[1.2, 0.7, 1.2]} />
      <mesh geometry={BOX} material={mat('#e6e3da')} position={[-tankX * 0.4, 0.55, d / 5]} scale={[1.1, 0.75, 0.7]} castShadow />
    </group>
  )
}

function Car({ x, z, color, rot = 0 }: { x: number; z: number; color: string; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh geometry={BOX} material={mat(color)} position={[0, 0.5, 0]} scale={[1.7, 0.55, 3.6]} castShadow />
      <mesh geometry={BOX} material={mat('#222826', { roughness: 0.3 })} position={[0, 0.98, -0.1]} scale={[1.45, 0.45, 1.9]} />
    </group>
  )
}

function Supermarket({ plot, theme, reducedMotion }: { plot: Plot; theme: Theme; reducedMotion: boolean }) {
  const { w, d } = plot
  return (
    <>
      <Shopfront w={w} d={d} theme={theme} />
      {/* deep entrance canopy on columns */}
      <mesh geometry={BOX} material={mat(C.forest)} position={[0, GF + 1.15, d / 2 + 2.2]} scale={[w - 3, 0.28, 4.4]} castShadow />
      {[-1, 1].flatMap((sx) => [0.7, 3.9].map((zo) => (
        <mesh key={`${sx}-${zo}`} geometry={CYL} material={mat('#8f938b')} position={[sx * (w / 2 - 2), (GF + 1.1) / 2, d / 2 + zo]} scale={[0.12, GF + 1.1, 0.12]} castShadow />
      )))}
      {/* forecourt + bay markings */}
      <mesh geometry={PLANE} material={mat('#bdb8a8')} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, d / 2 + 3.6]} scale={[w + 3, 7.2, 1]} receiveShadow />
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} geometry={PLANE} material={mat('#f4f8fc')} rotation={[-Math.PI / 2, 0, 0]} position={[-w / 2 + 1.5 + i * 1.7, 0.04, d / 2 + 5.2]} scale={[0.06, 3, 1]} />
      ))}
      <Car x={-w / 2 + 2.3} z={d / 2 + 5.2} color="#d9d4c4" rot={Math.PI / 2} />
      <Car x={-w / 2 + 4.0} z={d / 2 + 5.2} color="#0b8079" rot={Math.PI / 2} />
      <Car x={w / 2 - 2.2} z={d / 2 + 5.2} color="#ee5a36" rot={Math.PI / 2} />
      <Awning w={w - 6} z={d / 2 + 0.05} theme={theme} reducedMotion={reducedMotion} />
    </>
  )
}

function Provision({ plot, theme, reducedMotion }: { plot: Plot; theme: Theme; reducedMotion: boolean }) {
  const { w, d } = plot
  return (
    <>
      <Shopfront w={w} d={d} theme={theme} glowOverride={0.25} />
      {/* half-raised shutter slats + stacked sacks */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} geometry={BOX} material={mat('#8f938b')} position={[-w * 0.18, GF - 0.35 - i * 0.12, d / 2 + 0.2]} scale={[w * 0.4, 0.07, 0.08]} />
      ))}
      {[-1.8, -0.9, 0, 0.9].map((o, i) => (
        <mesh key={i} geometry={BOX} material={mat(i % 2 ? '#e0d3b4' : '#d4c59d')} position={[o - w * 0.12, 0.35, d / 2 + 1.1]} scale={[0.75, 0.6, 0.5]} castShadow />
      ))}
      <Awning w={w} z={d / 2 + 0.05} theme={theme} reducedMotion={reducedMotion} />
    </>
  )
}

function FruitHall({ plot, theme }: { plot: Plot; theme: Theme }) {
  const { w, d } = plot
  const cols = 5
  const crateColors = [C.terracotta, '#b6513a', C.olive, '#d9b44a', C.botanical]
  return (
    <>
      {/* open hall: back wall plus roof on columns, produce crates under the overhang */}
      {Array.from({ length: cols }, (_, i) => (
        <mesh key={i} geometry={CYL} material={mat('#8f938b')} position={[-w / 2 + 0.5 + (i * (w - 1)) / (cols - 1), GF / 2, d / 2 - 0.2]} scale={[0.14, GF, 0.14]} castShadow />
      ))}
      <mesh geometry={BOX} material={mat(theme.band)} position={[0, GF + 0.15, d / 2 + 0.6]} scale={[w + 0.6, 0.3, d * 0.2 + 1.8]} castShadow />
      <mesh geometry={BOX} material={mat('#f4f8fc')} position={[0, GF + 0.7, d / 2 + 1.5]} scale={[w - 1, 0.9, 0.14]} />
      {Array.from({ length: 14 }, (_, i) => {
        const row = i % 7
        const level = Math.floor(i / 7)
        return (
          <mesh key={i} geometry={BOX} material={mat(crateColors[i % crateColors.length])} position={[-w / 2 + 1.1 + row * ((w - 2.2) / 6), 0.3 + level * 0.55, d / 2 + 1.1]} scale={[1, 0.5, 0.8]} castShadow />
        )
      })}
      <mesh geometry={BOX} material={glassMat(0.15)} position={[0, GF / 2, d / 2 - 0.05]} scale={[w - 0.6, GF - 0.8, 0.05]} />
    </>
  )
}

function Bakery({ plot, theme, reducedMotion }: { plot: Plot; theme: Theme; reducedMotion: boolean }) {
  const { w, d } = plot
  return (
    <>
      <Shopfront w={w} d={d} theme={theme} />
      <Awning w={w} z={d / 2 + 0.05} theme={theme} reducedMotion={reducedMotion} />
      {/* projecting round blade sign */}
      <mesh geometry={BOX} material={mat(C.charcoal)} position={[w / 2 - 0.2, GF + 1.7, d / 2 + 0.35]} scale={[0.08, 0.08, 0.7]} />
      <mesh geometry={CYL} material={mat(C.terracotta)} position={[w / 2 - 0.2, GF + 1.7, d / 2 + 0.75]} rotation={[Math.PI / 2, 0, 0]} scale={[0.6, 0.1, 0.6]} castShadow />
      {/* two café tables on the pavement */}
      {[-1.4, 0.9].map((o) => (
        <group key={o} position={[o - w * 0.1, 0, d / 2 + 1.6]}>
          <mesh geometry={CYL} material={mat('#f4f8fc')} position={[0, 0.8, 0]} scale={[0.5, 0.06, 0.5]} castShadow />
          <mesh geometry={CYL} material={mat(C.charcoal)} position={[0, 0.4, 0]} scale={[0.06, 0.8, 0.06]} />
        </group>
      ))}
    </>
  )
}

function Dairy({ plot, theme, reducedMotion }: { plot: Plot; theme: Theme; reducedMotion: boolean }) {
  const { w, d } = plot
  return (
    <>
      <Shopfront w={w} d={d} theme={theme} />
      <Awning w={w} z={d / 2 + 0.05} theme={theme} reducedMotion={reducedMotion} />
      {/* chilled-cabinet strip at street level */}
      <mesh geometry={BOX} material={mat('#dfe6e4', { roughness: 0.25 })} position={[-w * 0.2, 0.6, d / 2 + 0.6]} scale={[w * 0.4, 1.0, 0.7]} castShadow />
      <mesh geometry={BOX} material={mat('#cfd9d6', { emissive: '#bfe3dc', emissiveIntensity: 0.25 })} position={[-w * 0.2, 1.15, d / 2 + 0.6]} scale={[w * 0.36, 0.04, 0.6]} />
    </>
  )
}

function Household({ plot, theme, reducedMotion }: { plot: Plot; theme: Theme; reducedMotion: boolean }) {
  const { w, d } = plot
  return (
    <>
      <Shopfront w={w} d={d} theme={theme} />
      <Awning w={w} z={d / 2 + 0.05} theme={theme} reducedMotion={reducedMotion} />
      {/* display racks seen through the glass */}
      {[-2.4, 0, 2.4].map((o) => (
        <mesh key={o} geometry={BOX} material={mat('#e3edf6', { emissive: '#ffe3b0', emissiveIntensity: 0.2 })} position={[o, 1.5, d / 2 - 0.1]} scale={[1.6, 1.8, 0.1]} />
      ))}
    </>
  )
}

/** Illuminated name boards (fascia + rooftop) and a beacon, so every shop can be spotted and read from afar. */
function Signage({ plot, store, reducedMotion }: { plot: Plot; store: Store; reducedMotion: boolean }) {
  const lang = useLang()
  const color = CAT_COLOR[plot.category]
  const tex = useMemo(() => makeNameBoard(store.name.en, store.name.ta, color), [store.name.en, store.name.ta, color])
  const boardMat = useMemo(() => new MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.5 }), [tex])
  const beacon = useRef<Group>(null)
  const beam = useRef<MeshStandardMaterial>(null)
  const glowAnim = useRef(boardMat)
  useEffect(
    () => () => {
      tex.dispose()
      boardMat.dispose()
    },
    [tex, boardMat],
  )
  const open = plot.category === 'fruit_veg'
  const { w, d, h } = plot
  const fasciaY = open ? GF + 0.7 : GF + 0.75
  const fasciaZ = open ? d / 2 + 1.58 : d / 2 + 0.24
  const fasciaW = open ? w - 1.3 : w - 0.8
  const roofW = Math.min(w * 0.82, 11)
  const roofZ = open ? -d / 2 + 0.75 : d / 2 - 0.35
  void lang
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!reducedMotion) {
      glowAnim.current.emissiveIntensity = 0.5 + Math.sin(t * 1.6 + plot.x) * 0.12
      if (beacon.current) {
        beacon.current.position.y = h + 4.6 + Math.sin(t * 1.4 + plot.x) * 0.45
        beacon.current.rotation.y = t * 0.9
      }
      if (beam.current) beam.current.opacity = 0.16 + Math.sin(t * 1.1 + plot.z) * 0.05
    }
  })
  return (
    <>
      <mesh geometry={PLANE} material={boardMat} position={[0, fasciaY, fasciaZ]} scale={[fasciaW, 0.82, 1]} />
      {/* rooftop board, tilted a touch towards the avenue */}
      <group position={[0, h + 1.15, roofZ]} rotation={[-0.08, 0, 0]}>
        <mesh geometry={PLANE} material={boardMat} position={[0, 0, 0.12]} scale={[roofW, roofW / 4, 1]} />
        <mesh geometry={BOX} material={mat('#10243a')} position={[0, 0, 0]} scale={[roofW + 0.3, roofW / 4 + 0.3, 0.18]} />
        {[-1, 1].map((s2) => (
          <mesh key={s2} geometry={BOX} material={mat('#10243a')} position={[s2 * (roofW / 2 - 0.4), -roofW / 8 - 0.5, -0.05]} scale={[0.14, 1.0, 0.14]} />
        ))}
      </group>
      {/* beacon: a bobbing gem over a soft beam of light */}
      <group ref={beacon} position={[0, h + 4.6, open ? -d / 2 + 1 : 0]}>
        <mesh scale={[0.9, 1.3, 0.9]}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} roughness={0.25} />
        </mesh>
      </group>
      <mesh position={[0, h + 9, open ? -d / 2 + 1 : 0]} raycast={() => null}>
        <cylinderGeometry args={[0.55, 1.5, 11, 16, 1, true]} />
        <meshStandardMaterial ref={beam} color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={0.16} depthWrite={false} side={2} />
      </mesh>
    </>
  )
}

export const StoreBuilding = memo(function StoreBuilding({
  plot,
  store,
  hovered,
  selected,
  dimmed,
  shadows,
  reducedMotion,
  onHover,
  onSelect,
}: Props) {
  const theme = THEMES[plot.category]
  const lift = useRef<Group>(null)
  const ring = useRef<MeshStandardMaterial>(null)
  const liftV = useRef(0)
  const invalidate = useThree((s) => s.invalidate)
  const floors = Math.max(2, Math.round(plot.h / 3.2))
  const open = plot.category === 'fruit_veg'

  // Facade textures per building (cloned from a tiny canvas) — sides carry windows, front is hidden by the shopfront below.
  const { sideTex, frontTex } = useMemo(() => {
    const base: Texture = makeFacadeTexture(theme.wall, '#33403d')
    const side = base.clone()
    side.repeat.set(Math.max(1, Math.round(plot.d / 3.5)), floors)
    side.needsUpdate = true
    const front = base.clone()
    front.repeat.set(Math.max(2, Math.round(plot.w / 3.5)), floors)
    front.offset.set(0, 0)
    front.needsUpdate = true
    return { sideTex: side, frontTex: front }
  }, [theme.wall, plot.d, plot.w, floors])

  useEffect(
    () => () => {
      sideTex.dispose()
      frontTex.dispose()
    },
    [sideTex, frontTex],
  )

  const bodyMats = useMemo(() => {
    const wall = mat(theme.wall)
    const side = new MeshStandardMaterial({ map: sideTex, roughness: 0.85 })
    const front = new MeshStandardMaterial({ map: frontTex, roughness: 0.85 })
    return [side, side, wall, wall, front, side]
  }, [theme.wall, sideTex, frontTex])

  useEffect(
    () => () => {
      bodyMats[0].dispose()
      bodyMats[4].dispose()
    },
    [bodyMats],
  )

  const target = dimmed ? 0 : selected ? 0.28 : hovered ? 0.16 : 0
  useFrame((_, delta) => {
    const next = reducedMotion ? target : MathUtils.damp(liftV.current, target, 9, delta)
    if (Math.abs(next - liftV.current) > 0.0005) {
      liftV.current = next
      if (lift.current) lift.current.position.y = next
      if (ring.current) ring.current.opacity = MathUtils.clamp(next * 3.2, 0, 0.85)
      if (reducedMotion) invalidate()
    }
  })

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
    onHover(store.id)
  }
  const handleOut = () => {
    document.body.style.cursor = ''
    onHover(null)
  }
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return // it was a drag, not a click
    onSelect(store.id)
  }

  return (
    <group position={[plot.x, 0, plot.z]} rotation={[0, plot.faces === 'north' ? Math.PI : 0, 0]}>
      {/* plot highlight ring: sits on the ground, fades in on hover/select */}
      <mesh geometry={PLANE} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]} scale={[plot.w + 1.4, plot.d + 1.4, 1]}>
        <meshStandardMaterial ref={ring} color={CAT_COLOR[plot.category]} transparent opacity={0} depthWrite={false} />
      </mesh>

      <group
        ref={lift}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        {open ? (
          <mesh geometry={BOX} material={mat(theme.wall)} position={[0, plot.h / 2, -plot.d / 2 + 0.3]} scale={[plot.w, plot.h, 0.6]} castShadow={shadows} receiveShadow={shadows} />
        ) : (
          <mesh geometry={BOX} material={bodyMats} position={[0, plot.h / 2, 0]} scale={[plot.w, plot.h, plot.d]} castShadow={shadows} receiveShadow={shadows} />
        )}
        {open && (
          <>
            {/* the hall behind the crates has a lower solid volume so the roof reads as one structure */}
            <mesh geometry={BOX} material={mat('#d9d4c4')} position={[0, GF + 0.4, 0]} scale={[plot.w, 0.5, plot.d]} castShadow={shadows} />
          </>
        )}
        {plot.category === 'supermarket' && <Supermarket plot={plot} theme={theme} reducedMotion={reducedMotion} />}
        {plot.category === 'provision' && <Provision plot={plot} theme={theme} reducedMotion={reducedMotion} />}
        {plot.category === 'fruit_veg' && <FruitHall plot={plot} theme={theme} />}
        {plot.category === 'bakery' && <Bakery plot={plot} theme={theme} reducedMotion={reducedMotion} />}
        {plot.category === 'dairy' && <Dairy plot={plot} theme={theme} reducedMotion={reducedMotion} />}
        {plot.category === 'household' && <Household plot={plot} theme={theme} reducedMotion={reducedMotion} />}
        {!open && <RoofKit w={plot.w} d={plot.d} h={plot.h} seed={plot.x} />}
        <Signage plot={plot} store={store} reducedMotion={reducedMotion} />
      </group>

    </group>
  )
})
