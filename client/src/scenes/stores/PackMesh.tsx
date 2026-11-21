import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { DoubleSide, MathUtils, MeshStandardMaterial, type Group, type Material } from 'three'
import gsap from 'gsap'
import type { ProductView } from '@thulir/shared'
import { designFor, shade, type ArtKind, type PackDesign, type Produce } from '@/components/products/packDesign'
import { dur } from '@/services/motion'
import { BOX, PLANE, mat } from '@/scenes/neighbourhood/shared3d'
import {
  UNIT,
  bananaGeo,
  bottleFlipGeo,
  bottleOilGeo,
  bottlePetGeo,
  boxGeo,
  canGeo,
  capGeo,
  coneGeo,
  jarGeo,
  labelBandGeo,
  milkPouchGeo,
  pillowGeo,
  sackGeo,
  sphereGeo,
  standupGeo,
  stickGeo,
  tubGeo,
} from './packGeometry'
import { blobTexture, faceTexture, priceTagTexture, standeeTexture, wobblerTexture, wrapTexture } from './packTexture'
import { packScale } from './shelfLayout'

/** Front edge of the shelf board (see StoreRoom). Packs stand just behind it. */
const SHELF_FRONT = 0.62
const BACK_LIMIT = -0.46

interface Props {
  product: ProductView
  x: number
  y: number
  /** Width of shelf this product owns. */
  width: number
  index: number
  hovered: boolean
  selected: boolean
  reducedMotion: boolean
  lowDetail: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

function rand(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/* --------------------------------------------------------------- materials */

const matCache = new Map<string, Material>()
function cached<T extends Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined
  if (!m) {
    m = make()
    matCache.set(key, m)
  }
  return m
}

/** Called when the shelf scene unmounts, together with disposePackTextures. */
export function disposePackMaterials() {
  matCache.forEach((m) => m.dispose())
  matCache.clear()
}

const ghost = (soldOut: boolean) => (soldOut ? { transparent: true, opacity: 0.38 } : {})

/** Plastic pouches catch light; cardboard and woven sacks do not. */
const finish = (k: ArtKind) => (k === 'sack' ? 0.85 : k === 'box' || k === 'tallbox' || k === 'widebox' || k === 'carton' || k === 'gable' ? 0.62 : 0.32)

/* --------------------------------------------------------------- one unit */

function Unit({ p, d, w, h, depth, soldOut }: { p: ProductView; d: PackDesign; w: number; h: number; depth: number; soldOut: boolean }) {
  const k = d.kind
  const rough = finish(k)
  const g = ghost(soldOut)
  const side = mat(d.base2, { roughness: rough, ...g })
  const top = mat(shade(d.base, 0.12), { roughness: rough, ...g })

  if (k === 'pillow' || k === 'standup' || k === 'sack' || k === 'milkpouch' || k === 'box' || k === 'tallbox' || k === 'widebox' || k === 'carton' || k === 'gable' || k === 'bar') {
    const sealed = k === 'pillow' || k === 'milkpouch'
    const front = cached(`front|${p.id}|${soldOut}`, () => new MeshStandardMaterial({ map: faceTexture(p, w / h, sealed), roughness: rough, ...g }))
    const geometry =
      k === 'pillow' ? pillowGeo() : k === 'standup' ? standupGeo() : k === 'sack' ? sackGeo() : k === 'milkpouch' ? milkPouchGeo() : boxGeo()
    return (
      <>
        <mesh geometry={geometry} material={[side, side, top, side, front, side]} position={[0, h / 2, 0]} scale={[w, h, depth]} />
        {k === 'carton' && <mesh geometry={capGeo()} material={mat(d.accent, g)} position={[w * 0.22, h + 0.03, 0]} scale={[0.07, 0.07, 0.07]} />}
        {k === 'gable' && <mesh geometry={coneGeoMemo} material={top} position={[0, h + 0.12, 0]} rotation={[0, Math.PI / 4, 0]} scale={[w * 0.72, 0.24, depth * 0.72]} />}
        {k === 'standup' && <mesh geometry={BOX} material={mat(shade(d.base2, -0.1), g)} position={[0, h - 0.04, 0]} scale={[w * 0.98, 0.07, depth * 0.14]} />}
      </>
    )
  }

  if (k === 'bottle-oil' || k === 'bottle-pet' || k === 'bottle-flip' || k === 'bottle-spray') {
    const r = w / 2
    const clear = k === 'bottle-oil' || k === 'bottle-pet'
    const body = mat(d.base, { roughness: 0.12, metalness: 0.05, transparent: clear || soldOut, opacity: soldOut ? 0.38 : clear ? 0.88 : 1 })
    const bodyGeo = k === 'bottle-oil' ? bottleOilGeo() : k === 'bottle-pet' ? bottlePetGeo() : bottleFlipGeo()
    const bandY = k === 'bottle-pet' ? 0.46 : k === 'bottle-oil' ? 0.28 : 0.2
    const bandH = k === 'bottle-pet' ? 0.26 : k === 'bottle-oil' ? 0.36 : 0.56
    const labelR = r * 1.012
    const label = cached(`wrap|${p.id}|${soldOut}`, () => new MeshStandardMaterial({ map: wrapTexture(p, (2 * Math.PI * labelR) / (h * bandH)), roughness: 0.4, ...g }))
    return (
      <>
        <mesh geometry={bodyGeo} material={body} scale={[r, h, r]} />
        <mesh geometry={labelBandGeo()} material={label} position={[0, h * (bandY + bandH / 2), 0]} scale={[labelR, h * bandH, labelR]} />
        {k === 'bottle-spray' ? (
          <>
            <mesh geometry={BOX} material={mat('#f4f4f4', g)} position={[0, h * 1.03, 0]} scale={[r * 0.8, h * 0.1, r * 0.8]} />
            <mesh geometry={BOX} material={mat('#f4f4f4', g)} position={[0, h * 1.07, r * 0.55]} scale={[r * 0.4, h * 0.05, r * 1.1]} />
            <mesh geometry={BOX} material={mat(shade(d.base, -0.3), g)} position={[0, h * 0.98, r * 0.6]} scale={[r * 0.25, h * 0.1, r * 0.25]} />
          </>
        ) : (
          <mesh
            geometry={capGeo()}
            material={mat(d.accent === '#ffffff' ? '#ececec' : d.accent, { roughness: 0.35, ...g })}
            position={[0, h * (k === 'bottle-flip' ? 1.0 : 0.985), 0]}
            scale={[r * (k === 'bottle-flip' ? 0.55 : 0.42), h * 0.07, r * (k === 'bottle-flip' ? 0.55 : 0.42)]}
          />
        )}
      </>
    )
  }

  if (k === 'jar' || k === 'tub' || k === 'can') {
    const r = w / 2
    const band = k === 'can' ? [0.08, 0.84] : k === 'jar' ? [0.18, 0.56] : [0.2, 0.62]
    const taper = k === 'tub' ? 0.12 : 0
    const labelR = r * (k === 'tub' ? 0.97 : 1.012)
    const label = cached(`wrap|${p.id}|${soldOut}`, () => new MeshStandardMaterial({ map: wrapTexture(p, (2 * Math.PI * labelR) / (h * band[1])), roughness: 0.35, ...g }))
    return (
      <>
        {k === 'can' ? (
          <mesh geometry={canGeo()} material={mat('#c9ccd1', { roughness: 0.25, metalness: 0.8, ...g })} position={[0, h / 2, 0]} scale={[r, h, r]} />
        ) : (
          <mesh geometry={k === 'jar' ? jarGeo() : tubGeo()} material={mat(d.base, { roughness: 0.2, ...g })} scale={[r, h, r]} />
        )}
        <mesh geometry={labelBandGeo(taper)} material={label} position={[0, h * (band[0] + band[1] / 2), 0]} scale={[labelR, h * band[1], labelR]} />
        {k !== 'can' && (
          <mesh
            geometry={capGeo()}
            material={mat(d.accent === '#ffffff' ? '#e9e9e9' : d.accent, { roughness: 0.3, ...g })}
            position={[0, h * (k === 'jar' ? 0.95 : 0.93), 0]}
            scale={[r * (k === 'jar' ? 0.94 : 1.06), h * (k === 'jar' ? 0.14 : 0.07), r * (k === 'jar' ? 0.94 : 1.06)]}
          />
        )}
      </>
    )
  }

  // Loaves, cakes, pastries and egg trays: the drawn pack, standing on the shelf.
  const sz = Math.max(w, h) * 1.25
  const standee = cached(`standee|${p.id}|${soldOut}`, () => new MeshStandardMaterial({ map: standeeTexture(p), transparent: true, alphaTest: 0.04, roughness: 0.6, side: DoubleSide, ...(soldOut ? { opacity: 0.38 } : {}) }))
  return <mesh geometry={PLANE} material={standee} position={[0, sz * 0.5 - sz * 0.075, 0]} scale={[sz, sz, 1]} />
}

const coneGeoMemo = coneGeo()

/* --------------------------------------------------------------- produce */

interface Item {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
}

const PRODUCE_LOOK: Record<Produce, { color: string; rough: number; draw: 'round' | 'long' | 'cone' | 'bunch' | 'banana' }> = {
  tomato: { color: '#d9302c', rough: 0.3, draw: 'round' },
  apple: { color: '#c4232f', rough: 0.3, draw: 'round' },
  onion: { color: '#a2405f', rough: 0.45, draw: 'round' },
  potato: { color: '#c49a5c', rough: 0.9, draw: 'round' },
  lemon: { color: '#f2d23a', rough: 0.5, draw: 'round' },
  garlic: { color: '#efe8dc', rough: 0.7, draw: 'round' },
  coconut: { color: '#6b4226', rough: 0.95, draw: 'round' },
  ginger: { color: '#c9a36b', rough: 0.85, draw: 'round' },
  papaya: { color: '#f08a2a', rough: 0.4, draw: 'round' },
  brinjal: { color: '#5b2a6e', rough: 0.25, draw: 'long' },
  carrot: { color: '#ee7a1f', rough: 0.6, draw: 'cone' },
  okra: { color: '#7fae3f', rough: 0.6, draw: 'cone' },
  chilli: { color: '#3f8f2f', rough: 0.35, draw: 'cone' },
  drumstick: { color: '#6f9a3a', rough: 0.7, draw: 'long' },
  leaves: { color: '#3f8a36', rough: 0.7, draw: 'bunch' },
  banana: { color: '#f1cf3b', rough: 0.45, draw: 'banana' },
  mixed: { color: '#d9302c', rough: 0.4, draw: 'round' },
}

const ITEM_SIZE: Partial<Record<Produce, [number, number, number]>> = {
  tomato: [0.13, 0.115, 0.13],
  apple: [0.14, 0.13, 0.14],
  onion: [0.13, 0.15, 0.13],
  potato: [0.16, 0.11, 0.12],
  lemon: [0.1, 0.085, 0.085],
  garlic: [0.1, 0.09, 0.1],
  coconut: [0.2, 0.19, 0.2],
  ginger: [0.14, 0.07, 0.08],
  papaya: [0.3, 0.17, 0.17],
  brinjal: [0.09, 0.09, 0.22],
  drumstick: [0.02, 0.02, 0.62],
}

function Produce({ d, width, soldOut, low }: { d: PackDesign; width: number; soldOut: boolean; low: boolean }) {
  const kind = d.produce ?? 'mixed'
  const look = PRODUCE_LOOK[kind]
  const cw = width
  const cd = 0.9
  const wall = 0.36
  const g = ghost(soldOut)
  const items = useMemo<Item[]>(() => {
    const R = rand(d.seed)
    const n = low ? 10 : kind === 'coconut' || kind === 'papaya' ? 9 : kind === 'drumstick' ? 22 : 20
    const out: Item[] = []
    for (let i = 0; i < n; i++) {
      const x = (R() - 0.5) * cw * 0.78
      const z = (R() - 0.5) * cd * 0.6
      const mound = 1 - Math.min(1, Math.hypot(x / (cw * 0.42), z / (cd * 0.35)))
      out.push({ x, z, y: wall * 0.7 + mound * 0.22 + R() * 0.05, rx: R() * Math.PI, ry: R() * Math.PI * 2, rz: R() * Math.PI })
    }
    return out.sort((a, b) => a.y - b.y)
  }, [d.seed, cw, kind, low])

  const wood = mat('#a5794a', { roughness: 0.9, ...g })
  const woodDark = mat('#7c5530', { roughness: 0.9, ...g })
  const body = mat(look.color, { roughness: look.rough, ...g })
  const green = mat('#3d7f2c', { roughness: 0.6, ...g })
  const size = ITEM_SIZE[kind] ?? [0.12, 0.11, 0.12]

  return (
    <group>
      {/* crate: base, low front, sides and back */}
      <mesh geometry={BOX} material={woodDark} position={[0, 0.04, 0]} scale={[cw, 0.08, cd]} />
      {[0.1, 0.26].map((yy) => (
        <mesh key={yy} geometry={BOX} material={wood} position={[0, yy, cd / 2 - 0.02]} scale={[cw, 0.12, 0.04]} />
      ))}
      <mesh geometry={BOX} material={wood} position={[0, wall / 2 + 0.06, -cd / 2 + 0.02]} scale={[cw, wall + 0.12, 0.04]} />
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={BOX} material={woodDark} position={[(sx * cw) / 2, wall / 2, 0]} scale={[0.05, wall, cd]} />
      ))}
      {items.map((it, i) => {
        const key = `${i}`
        switch (look.draw) {
          case 'round':
            return (
              <group key={key} position={[it.x, it.y, it.z]} rotation={[0, it.ry, kind === 'papaya' ? 0.2 : 0]}>
                <mesh geometry={sphereGeo()} material={kind === 'papaya' && i % 2 ? mat('#7aa33a', { roughness: 0.4, ...g }) : body} scale={size} />
                {(kind === 'tomato' || kind === 'apple') && <mesh geometry={coneGeoMemo} material={green} position={[0, size[1] * 0.95, 0]} scale={[0.035, 0.04, 0.035]} />}
              </group>
            )
          case 'long':
            return kind === 'drumstick' ? (
              <mesh key={key} geometry={stickGeo()} material={body} position={[it.x * 0.15, it.y, it.z]} rotation={[0, (it.ry - Math.PI) * 0.04, Math.PI / 2]} scale={[0.022, cw * 0.8, 0.022]} />
            ) : (
              <mesh key={key} geometry={sphereGeo()} material={body} position={[it.x * 0.9, it.y, it.z]} rotation={[0, it.ry, 0.1]} scale={size} />
            )
          case 'cone': {
            const len = kind === 'carrot' ? 0.4 : kind === 'okra' ? 0.26 : 0.2
            const rad = kind === 'carrot' ? 0.05 : kind === 'okra' ? 0.035 : 0.018
            return (
              <group key={key} position={[it.x, it.y, it.z]} rotation={[0, it.ry, Math.PI / 2 + (it.rz - 1.5) * 0.15]}>
                <mesh geometry={coneGeoMemo} material={body} scale={[rad, len, rad]} />
                {kind === 'carrot' && <mesh geometry={coneGeoMemo} material={green} position={[0, -len * 0.62, 0]} rotation={[Math.PI, 0, 0]} scale={[0.04, 0.14, 0.04]} />}
              </group>
            )
          }
          case 'bunch':
            return (
              <mesh key={key} geometry={sphereGeo()} material={i % 3 ? body : mat('#5aa848', { roughness: 0.7, ...g })} position={[it.x * 0.7, wall + 0.14, it.z * 0.6]} rotation={[it.rx * 0.3 - 0.2, it.ry, it.rz * 0.3 - 0.2]} scale={[0.09, 0.26, 0.03]} />
            )
          case 'banana':
            return i % 4 === 0 ? (
              <group key={key} position={[it.x * 0.7, wall + 0.12, it.z * 0.4]} rotation={[0, it.ry, 0]}>
                {[0, 1, 2, 3, 4].map((b) => (
                  <mesh key={b} geometry={bananaGeo()} material={body} position={[(b - 2) * 0.06, 0, (b - 2) * 0.015]} rotation={[0, 0, Math.PI * 0.72]} scale={[0.28, 0.28, 0.4]} />
                ))}
              </group>
            ) : null
        }
        return null
      })}
    </group>
  )
}

/* --------------------------------------------------------------- the bay */

/**
 * One product's place on the shelf: several units faced up side by side (fewer when stock is low), a second row
 * behind, the shelf-edge price ticket, and a swinging "Save" sign for offers. Hover lifts the front unit; selecting
 * takes it off the shelf towards the shopper and turns it slowly, as if picked up.
 */
export const PackMesh = memo(function PackMesh({ product: p, x, y, width, index, hovered, selected, reducedMotion, lowDetail, onHover, onSelect }: Props) {
  const group = useRef<Group>(null)
  const hero = useRef<Group>(null)
  const wobbler = useRef<Group>(null)
  const anim = useRef({ lift: 0, fwd: 0, spin: 0, tilt: 0 })
  const invalidate = useThree((s) => s.invalidate)
  const d = designFor(p)
  const soldOut = !p.eligibility.sellable
  const [uw, uh, ud] = UNIT[d.kind]
  const s = d.kind === 'produce' ? 1 : MathUtils.clamp(packScale(p.unit), 0.72, 1.18)
  const W = d.kind === 'produce' ? Math.min(width - 0.25, 1.75) : uw * s
  const H = uh * s
  const D = ud * s
  const gap = 0.06

  const units = useMemo(() => {
    if (d.kind === 'produce') return [{ x: 0, z: SHELF_FRONT - 0.5, ry: 0 }]
    const R = rand(d.seed)
    const facings = MathUtils.clamp(Math.floor((width - 0.12) / (W + gap)), 1, lowDetail ? 2 : 5)
    const frontZ = SHELF_FRONT - D / 2
    const backZ = frontZ - D - 0.05
    const rows = backZ - D / 2 > BACK_LIMIT ? 2 : 1
    const stock = soldOut ? 1 : Math.max(1, Math.min(facings * rows, p.eligibility.sellableQty))
    const out: { x: number; z: number; ry: number }[] = []
    for (let i = 0; i < stock; i++) {
      const row = i < facings ? 0 : 1
      const col = i % facings
      out.push({ x: (col - (facings - 1) / 2) * (W + gap) + (R() - 0.5) * 0.03, z: row ? backZ : frontZ, ry: (R() - 0.5) * 0.09 })
    }
    return out
  }, [d.kind, d.seed, width, W, D, soldOut, p.eligibility.sellableQty, lowDetail])
  const facingsShown = units.filter((u) => u.z === units[0].z).length
  const heroIdx = Math.floor((facingsShown - 1) / 2)

  // Stocking the shelf: packs drop in, staggered by position. Skipped under reduced motion.
  useEffect(() => {
    const g = group.current
    if (!g) return
    const dd = dur(0.6)
    if (dd === 0) {
      g.scale.setScalar(1)
      g.position.y = y
      invalidate()
      return
    }
    g.scale.setScalar(0.001)
    g.position.y = y + 0.9
    const delay = Math.min(index * 0.05, 0.8)
    const a = gsap.to(g.scale, { x: 1, y: 1, z: 1, duration: dd * 0.6, delay, ease: 'power2.out', onUpdate: invalidate })
    const b = gsap.to(g.position, { y, duration: dd, delay, ease: 'bounce.out', onUpdate: invalidate })
    return () => {
      a.kill()
      b.kill()
    }
  }, [y, index, invalidate])

  useFrame((state, delta) => {
    const a = anim.current
    const t = state.clock.elapsedTime
    const target = { lift: selected ? 0.5 : hovered ? 0.12 : 0, fwd: selected ? 0.9 : hovered ? 0.06 : 0, tilt: hovered && !selected ? -0.08 : 0 }
    if (reducedMotion) {
      a.lift = target.lift
      a.fwd = target.fwd
      a.tilt = target.tilt
      a.spin = 0
    } else {
      a.lift = MathUtils.damp(a.lift, target.lift, 8, delta)
      a.fwd = MathUtils.damp(a.fwd, target.fwd, 8, delta)
      a.tilt = MathUtils.damp(a.tilt, target.tilt, 8, delta)
      a.spin = selected ? Math.sin(t * 0.9) * 0.55 : MathUtils.damp(a.spin, 0, 6, delta)
    }
    const h = hero.current
    if (h) {
      h.position.y = a.lift + (selected && !reducedMotion ? Math.sin(t * 2) * 0.03 : 0)
      h.position.z = (units[heroIdx]?.z ?? 0) + a.fwd
      h.rotation.y = (units[heroIdx]?.ry ?? 0) + a.spin
      h.rotation.x = a.tilt
    }
    const wb = wobbler.current
    if (wb && !reducedMotion) wb.rotation.z = Math.sin(t * 1.8 + index) * 0.16
  })
  // On-demand rendering (reduced motion): draw one frame when the pose target changes.
  useEffect(() => {
    if (reducedMotion) invalidate()
  }, [hovered, selected, reducedMotion, invalidate])

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
    onHover(p.id)
  }
  const out = () => {
    document.body.style.cursor = ''
    onHover(null)
  }

  const blob = useMemo(() => new MeshStandardMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.55 }), [])
  useEffect(() => () => blob.dispose(), [blob])
  const tag = useMemo(() => new MeshStandardMaterial({ map: priceTagTexture(p, soldOut), roughness: 0.6 }), [p, soldOut])
  useEffect(() => () => tag.dispose(), [tag])
  const wob = useMemo(() => (p.discountPercent > 0 && !soldOut ? new MeshStandardMaterial({ map: wobblerTexture(p.discountPercent), transparent: true, alphaTest: 0.05, side: DoubleSide }) : null), [p.discountPercent, soldOut])
  useEffect(() => () => wob?.dispose(), [wob])
  const tagW = Math.min(width * 0.62, 1.5)

  return (
    <group ref={group} position={[x, y, 0]} onPointerOver={over} onPointerOut={out} onClick={(e) => { e.stopPropagation(); onSelect(p.id) }}>
      {units.map((u, i) =>
        i === heroIdx ? (
          <group key={i} ref={hero} position={[u.x, 0, u.z]} rotation={[0, u.ry, 0]}>
            <mesh geometry={PLANE} material={blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} scale={[W * 1.3, D * 1.6, 1]} />
            {d.kind === 'produce' ? <Produce d={d} width={W} soldOut={soldOut} low={lowDetail} /> : <Unit p={p} d={d} w={W} h={H} depth={D} soldOut={soldOut} />}
          </group>
        ) : (
          <group key={i} position={[u.x, 0, u.z]} rotation={[0, u.ry, 0]}>
            <mesh geometry={PLANE} material={blob} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} scale={[W * 1.3, D * 1.6, 1]} />
            <Unit p={p} d={d} w={W} h={H} depth={D} soldOut={soldOut} />
          </group>
        ),
      )}
      {/* shelf-edge ticket */}
      <mesh geometry={PLANE} material={tag} position={[0, -0.13, SHELF_FRONT + 0.075]} scale={[tagW, tagW / 3, 1]} />
      {wob && (
        <group ref={wobbler} position={[Math.min(width / 2 - 0.25, tagW / 2 + 0.25), -0.02, SHELF_FRONT + 0.2]}>
          <mesh geometry={BOX} material={mat('#e9e9e9')} position={[0, 0, -0.1]} scale={[0.02, 0.02, 0.22]} />
          <mesh geometry={PLANE} material={wob} position={[0, -0.2, 0.02]} scale={[0.42, 0.42, 1]} />
        </group>
      )}
    </group>
  )
})
