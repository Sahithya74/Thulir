import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, MathUtils, SRGBColorSpace } from 'three'
import gsap from 'gsap'
import type { ProductView } from '@thulir/shared'
import { dur, ease } from '@/services/motion'
import type { QualityTier } from '@/hooks/useDevice'
import { disposePackTextures } from './packTexture'
import { layoutShelf } from './shelfLayout'
import { StoreRoom } from './StoreRoom'
import type { StoreTheme } from './themes'

interface Pose {
  px: number
  py: number
  pz: number
  tx: number
  ty: number
  tz: number
}

function StoreCamera({ products, selectedId, reducedMotion }: { products: ProductView[]; selectedId: string | null; reducedMotion: boolean }) {
  const { camera, size, invalidate } = useThree()
  const { slots, levels, width } = useMemo(() => layoutShelf(products.length), [products.length])
  const aspect = size.width / Math.max(size.height, 1)

  // Distance that fits the whole shelf unit, whatever the canvas shape: the larger of the width fit and height fit.
  const fit = useMemo(() => {
    const half = Math.tan(MathUtils.degToRad(38 / 2))
    const byWidth = (width / 2 + 1.1) / (half * Math.max(aspect, 0.4))
    const byHeight = (levels * 1.75 + 1.9) / 2 / half
    return Math.max(7.5, byWidth, byHeight)
  }, [aspect, width, levels])

  const overview = useMemo<Pose>(() => {
    const cy = 0.9 + ((levels - 1) * 1.75) / 2 + 0.9
    return { px: 0, py: cy + 1.3, pz: fit, tx: 0, ty: cy, tz: 0 }
  }, [levels, fit])

  const cur = useRef<Pose>({ ...overview, pz: overview.pz + 6, py: overview.py + 1.5 })
  const tween = useRef<gsap.core.Tween | null>(null)
  const first = useRef(true)

  useEffect(() => {
    const idx = selectedId ? products.findIndex((p) => p.id === selectedId) : -1
    const slot = idx >= 0 ? slots[idx] : null
    const next: Pose = slot
      ? { px: slot.x * 0.55, py: slot.y + 1.1, pz: 5.2, tx: slot.x, ty: slot.y + 0.55, tz: 0 }
      : overview
    tween.current?.kill()
    const d = first.current ? dur(1.6) : dur(0.8)
    first.current = false
    if (d === 0) Object.assign(cur.current, next)
    else tween.current = gsap.to(cur.current, { ...next, duration: d, ease: ease.inOut, onUpdate: invalidate })
    invalidate()
    return () => {
      tween.current?.kill()
    }
  }, [selectedId, products, slots, overview, invalidate])

  useFrame((state) => {
    const c = cur.current
    const par = reducedMotion ? { x: 0, y: 0 } : state.pointer
    camera.position.set(c.px + par.x * 0.4, c.py + par.y * 0.15, c.pz)
    camera.lookAt(c.tx, c.ty, c.tz)
    if (!reducedMotion && (Math.abs(par.x) > 0.001 || Math.abs(par.y) > 0.001)) state.invalidate()
  })
  return null
}

interface Props {
  theme: StoreTheme
  products: ProductView[]
  selectedId: string | null
  hoveredId: string | null
  reducedMotion: boolean
  tier: QualityTier
  label: string
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

/** Lazy-loaded 3D shelf for a store department. Default export so React.lazy can load it. */
export default function StoreCanvas({ theme, products, selectedId, hoveredId, reducedMotion, tier, label, onHover, onSelect }: Props) {
  useEffect(() => () => disposePackTextures(), [])
  return (
    <Canvas
      role="group"
      aria-label={label}
      // Pointer parallax needs frames; with reduced motion we only render on demand.
      frameloop={reducedMotion ? 'demand' : 'always'}
      dpr={tier === 'low' ? [1, 1.25] : [1, 1.75]}
      camera={{ fov: 38, near: 0.5, far: 120, position: [0, 4, 18] }}
      gl={{ antialias: tier !== 'low', powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 0.95
        gl.outputColorSpace = SRGBColorSpace
        scene.background = null
      }}
      style={{ touchAction: 'pan-y', background: theme.sky }}
    >
      <Suspense fallback={null}>
        <hemisphereLight args={[theme.sky, theme.floor, theme.hemiI]} />
        <directionalLight color={theme.light} intensity={theme.lightI} position={[5, 11, 12]} />
        <pointLight color={theme.light} intensity={14} distance={20} position={[0, 4.5, 4]} />
        <StoreCamera products={products} selectedId={selectedId} reducedMotion={reducedMotion} />
        <StoreRoom theme={theme} products={products} selectedId={selectedId} hoveredId={hoveredId} reducedMotion={reducedMotion} onHover={onHover} onSelect={onSelect} />
      </Suspense>
    </Canvas>
  )
}
