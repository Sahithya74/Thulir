import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { MathUtils, MeshBasicMaterial, SphereGeometry, type Group, type MeshStandardMaterial } from 'three'
import gsap from 'gsap'
import type { ProductView } from '@thulir/shared'
import { dur } from '@/services/motion'
import { BOX, CYL, PLANE, mat } from '@/scenes/neighbourhood/shared3d'
import { packTexture } from './packTexture'
import { packScale } from './shelfLayout'

const SPHERE = new SphereGeometry(1, 12, 9)
const CRATE_FRUIT = ['#c98255', '#b6513a', '#77856b', '#d9b44a', '#a8b89a', '#9a5c3c']

interface Props {
  product: ProductView
  x: number
  y: number
  index: number
  hovered: boolean
  selected: boolean
  reducedMotion: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

type Label = { z: number; w: number; h: number; y: number }

function Body({ p, soldOut }: { p: ProductView; soldOut: boolean }) {
  const base = soldOut ? { transparent: true, opacity: 0.4 } : {}
  const body = mat(p.color, base)
  const dark = mat('#202522', base)
  switch (p.shape) {
    case 'bottle':
      return (
        <>
          <mesh geometry={CYL} material={body} position={[0, 0.55, 0]} scale={[0.28, 1.1, 0.28]} />
          <mesh geometry={CYL} material={body} position={[0, 1.22, 0]} scale={[0.13, 0.34, 0.13]} />
          <mesh geometry={CYL} material={dark} position={[0, 1.42, 0]} scale={[0.15, 0.1, 0.15]} />
        </>
      )
    case 'jar':
      return (
        <>
          <mesh geometry={CYL} material={body} position={[0, 0.45, 0]} scale={[0.42, 0.9, 0.42]} />
          <mesh geometry={CYL} material={dark} position={[0, 0.97, 0]} scale={[0.44, 0.14, 0.44]} />
        </>
      )
    case 'pouch':
      return (
        <>
          <mesh geometry={BOX} material={body} position={[0, 0.55, 0]} scale={[0.85, 1.1, 0.28]} />
          <mesh geometry={BOX} material={dark} position={[0, 1.1, 0]} scale={[0.85, 0.07, 0.3]} />
        </>
      )
    case 'carton':
      return (
        <>
          <mesh geometry={BOX} material={body} position={[0, 0.57, 0]} scale={[0.55, 1.15, 0.45]} />
          <mesh geometry={BOX} material={dark} position={[0, 1.24, 0]} scale={[0.55, 0.16, 0.22]} />
        </>
      )
    case 'tub':
      return (
        <>
          <mesh geometry={CYL} material={body} position={[0, 0.31, 0]} scale={[0.48, 0.62, 0.48]} />
          <mesh geometry={CYL} material={dark} position={[0, 0.67, 0]} scale={[0.5, 0.1, 0.5]} />
        </>
      )
    case 'bar':
      return <mesh geometry={BOX} material={body} position={[0, 0.15, 0]} scale={[0.9, 0.3, 0.5]} />
    case 'crate':
      return (
        <>
          <mesh geometry={BOX} material={mat('#a88257', base)} position={[0, 0.2, 0]} scale={[1, 0.4, 0.75]} />
          {Array.from({ length: 6 }, (_, i) => (
            <mesh
              key={i}
              geometry={SPHERE}
              material={mat(i % 2 ? CRATE_FRUIT[(i + 2) % 6] : p.color, base)}
              position={[(i % 3) * 0.3 - 0.3, 0.46, i < 3 ? -0.14 : 0.14]}
              scale={0.16}
            />
          ))}
        </>
      )
    case 'box':
    default:
      return <mesh geometry={BOX} material={body} position={[0, 0.55, 0]} scale={[0.8, 1.1, 0.45]} />
  }
}

const LABELS: Record<ProductView['shape'], Label> = {
  box: { z: 0.23, w: 0.62, h: 0.5, y: 0.55 },
  bottle: { z: 0.29, w: 0.46, h: 0.4, y: 0.5 },
  pouch: { z: 0.15, w: 0.64, h: 0.52, y: 0.55 },
  jar: { z: 0.43, w: 0.62, h: 0.46, y: 0.45 },
  crate: { z: 0.38, w: 0.74, h: 0.26, y: 0.2 },
  carton: { z: 0.23, w: 0.42, h: 0.5, y: 0.55 },
  tub: { z: 0.49, w: 0.62, h: 0.36, y: 0.31 },
  bar: { z: 0.26, w: 0.72, h: 0.24, y: 0.15 },
}

/** One product on the shelf: shape by pack type, label texture, hover lift and a staggered "emerge" on mount. */
export const PackMesh = memo(function PackMesh({ product: p, x, y, index, hovered, selected, reducedMotion, onHover, onSelect }: Props) {
  const group = useRef<Group>(null)
  const lift = useRef<Group>(null)
  const ring = useRef<MeshStandardMaterial>(null)
  const liftV = useRef(0)
  const invalidate = useThree((s) => s.invalidate)
  const soldOut = !p.eligibility.sellable
  const scale = packScale(p.unit)
  const label = LABELS[p.shape]

  const labelMat = useMemo(() => {
    const m = new MeshBasicMaterial({ map: packTexture(p), transparent: soldOut, opacity: soldOut ? 0.45 : 1 })
    return m
  }, [p, soldOut])
  useEffect(() => () => labelMat.dispose(), [labelMat])

  // Emergence: scale up from nothing, staggered by position. Skipped under reduced motion.
  useEffect(() => {
    const g = group.current
    if (!g) return
    const d = dur(0.5)
    if (d === 0) {
      g.scale.setScalar(scale)
      invalidate()
      return
    }
    g.scale.setScalar(0.001)
    const tw = gsap.to(g.scale, { x: scale, y: scale, z: scale, duration: d, delay: Math.min(index * 0.035, 0.7), ease: 'power2.out', onUpdate: invalidate })
    return () => {
      tw.kill()
    }
  }, [scale, index, invalidate])

  const target = selected ? 0.22 : hovered ? 0.12 : 0
  useFrame((_, delta) => {
    const next = reducedMotion ? target : MathUtils.damp(liftV.current, target, 10, delta)
    if (Math.abs(next - liftV.current) > 0.0004) {
      liftV.current = next
      if (lift.current) lift.current.position.y = next
      if (ring.current) ring.current.opacity = MathUtils.clamp(next * 5, 0, 0.9)
      if (reducedMotion) invalidate()
    }
  })

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
    onHover(p.id)
  }
  const out = () => {
    document.body.style.cursor = ''
    onHover(null)
  }

  return (
    <group ref={group} position={[x, y, 0.1]} onPointerOver={over} onPointerOut={out} onClick={(e) => { e.stopPropagation(); onSelect(p.id) }}>
      <mesh geometry={CYL} position={[0, 0.01, 0.05]} scale={[0.78, 0.012, 0.78]}>
        <meshStandardMaterial ref={ring} color="#c98255" transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={lift}>
        <Body p={p} soldOut={soldOut} />
        <mesh geometry={PLANE} material={labelMat} position={[0, label.y, label.z]} scale={[label.w, label.h, 1]} />
      </group>
    </group>
  )
})
