import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace, type PointLight } from 'three'
import type { Localised } from '@thulir/shared'
import type { QualityTier } from '@/hooks/useDevice'
import { BOX, PLANE, mat } from '@/scenes/neighbourhood/shared3d'
import { PackMesh, disposePackMaterials } from './PackMesh'
import { disposePackTextures } from './packTexture'
import type { StoreTheme } from './themes'
import { AisleSigns, Bay, GondolaFrame, WalkRoom } from './WalkRoom'
import { Shoppers } from './People'
import { SimpleShoppers } from './WalkLife'
import { WalkRig } from './WalkRig'
import { planStore, type WalkPlan } from './walkLayout'
import { walkCmd } from './walkBus'

export { planStore }

interface Props {
  plan: WalkPlan
  theme: StoreTheme
  storeName: Localised
  selectedId: string | null
  hoveredId: string | null
  reducedMotion: boolean
  tier: QualityTier
  label: string
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onNearDept: (dept: string | null) => void
}

/** A soft lamp that follows the shopper, so the shelves in front of them are always well lit. */
function HeadLamp({ intensity }: { intensity: number }) {
  const ref = useRef<PointLight>(null)
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    if (ref.current) ref.current.position.set(camera.position.x, camera.position.y + 1.2, camera.position.z)
  })
  return <pointLight ref={ref} color="#fff4e2" intensity={intensity} distance={26} decay={1.6} />
}

function Outside({ plan, theme }: { plan: WalkPlan; theme: StoreTheme }) {
  return (
    <group>
      <mesh geometry={PLANE} material={mat('#c9d3dc')} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, plan.depth + 18]} scale={[160, 40, 1]} />
      <mesh geometry={PLANE} material={mat('#3a4452')} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, plan.depth + 26]} scale={[160, 9, 1]} />
      <mesh geometry={BOX} material={mat(theme.accent)} position={[0, 0.05, plan.depth + 2.2]} scale={[plan.door.w + 2, 0.1, 3.6]} />
    </group>
  )
}

function Scene({ plan, theme, storeName, selectedId, hoveredId, reducedMotion, tier, onHover, onSelect, onNearDept }: Props) {
  const low = tier === 'low'
  const floorClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return
    e.stopPropagation()
    walkCmd.emit({ type: 'point', x: e.point.x, z: e.point.z })
  }
  return (
    <>
      <color attach="background" args={['#cfe6f6']} />
      <hemisphereLight args={['#ffffff', theme.floor, theme.hemiI * 1.15]} />
      <directionalLight color={theme.light} intensity={theme.lightI * 0.7} position={[6, 12, 20]} />
      <HeadLamp intensity={low ? 14 : 26} />
      <WalkRoom plan={plan} theme={theme} storeName={storeName} reducedMotion={reducedMotion} />
      {/* invisible, slightly raised floor catches the walk-here clicks */}
      <mesh geometry={PLANE} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, plan.depth / 2]} scale={[plan.width, plan.depth, 1]} onClick={floorClick}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Outside plan={plan} theme={theme} />
      <AisleSigns plan={plan} theme={theme} />
      {plan.gondolas.map((g, i) => (
        <GondolaFrame key={i} x={g.x} z={g.z} length={g.length} theme={theme} />
      ))}
      {plan.faces.map((face) => (
        <group key={face.index} position={[face.x, 0, face.z]} rotation={[0, face.rotY, 0]}>
          <Bay face={face} theme={theme} />
          {face.slots.map((s, i) => (
            <PackMesh
              key={`${face.index}-${i}`}
              product={s.product}
              x={s.x}
              y={s.y}
              width={s.w}
              index={face.index * 9 + i}
              hovered={hoveredId === s.product.id}
              selected={selectedId === s.product.id}
              reducedMotion={reducedMotion}
              lowDetail={low}
              onHover={onHover}
              onSelect={onSelect}
            />
          ))}
        </group>
      ))}
      {low ? <SimpleShoppers plan={plan} reducedMotion={reducedMotion} count={3} /> : <Shoppers plan={plan} reducedMotion={reducedMotion} count={Math.min(6, 3 + plan.lanesZ.length * 2)} />}
      <WalkRig plan={plan} selectedId={selectedId} reducedMotion={reducedMotion} onNearDept={onNearDept} />
    </>
  )
}

/** Lazy-loaded walk-in store. Default export so React.lazy can load it. */
export default function StoreWalk(props: Props) {
  const { tier, label, theme } = props
  useEffect(
    () => () => {
      disposePackMaterials()
      disposePackTextures()
    },
    [],
  )
  return (
    <Canvas
      role="group"
      aria-label={label}
      frameloop="always"
      dpr={tier === 'low' ? [1, 1.25] : [1, 1.75]}
      camera={{ fov: 62, near: 0.3, far: 140, position: [0, 3.2, props.plan.depth + 8] }}
      gl={{ antialias: tier !== 'low', powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.outputColorSpace = SRGBColorSpace
        scene.background = null
      }}
      style={{ touchAction: 'none', background: theme.sky, cursor: 'grab' }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  )
}
