import { useMemo } from 'react'
import type { ProductView } from '@thulir/shared'
import { BOX, CYL, PLANE, mat } from '@/scenes/neighbourhood/shared3d'
import { PackMesh } from './PackMesh'
import { layoutShelf, shelfY } from './shelfLayout'
import type { StoreTheme } from './themes'

const glowMat = (color: string, i = 1.2) => mat(color, { emissive: color, emissiveIntensity: i, roughness: 0.4 })

function Room({ theme }: { theme: StoreTheme }) {
  const f = theme.fixture
  return (
    <group>
      <mesh geometry={PLANE} material={mat(theme.floor, { roughness: 0.9 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4]} scale={[40, 24, 1]} />
      {/* back wall + side walls */}
      <mesh geometry={BOX} material={mat(theme.wall)} position={[0, 5, -1.4]} scale={[40, 10, 0.3]} />
      <mesh geometry={BOX} material={mat(theme.wall)} position={[-12, 5, 4]} scale={[0.3, 10, 24]} />
      <mesh geometry={BOX} material={mat(theme.wall)} position={[12, 5, 4]} scale={[0.3, 10, 24]} />
      {/* skirting */}
      <mesh geometry={BOX} material={mat(theme.trim)} position={[0, 0.15, -1.2]} scale={[40, 0.3, 0.12]} />

      {(f === 'aisle' || f === 'rack' || f === 'chilled') &&
        [-6, 0, 6].map((x) => <mesh key={x} geometry={BOX} material={glowMat('#fffaf0', 1.5)} position={[x, 7.2, 2]} scale={[4, 0.1, 0.5]} />)}

      {(f === 'pantry' || f === 'counter') &&
        [-6, -2, 2, 6].map((x) => (
          <group key={x} position={[x, 0, 1.5]}>
            <mesh geometry={CYL} material={mat('#3b3f3b')} position={[0, 6.6, 0]} scale={[0.02, 1.6, 0.02]} />
            <mesh geometry={BOX} material={glowMat('#ffd9a0', 2)} position={[0, 5.7, 0]} scale={[0.4, 0.4, 0.4]} />
          </group>
        ))}

      {f === 'market' &&
        Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} geometry={BOX} material={mat(i % 2 ? '#f5f2ea' : theme.accent)} position={[-11 + i * 2, 6.6, 1.8]} rotation={[0.35, 0, 0]} scale={[2, 0.1, 3.2]} />
        ))}

      {/* signature dressing per fixture */}
      {f === 'pantry' &&
        [-9, 9].map((x) => (
          <group key={x} position={[x, 0, 1.5]}>
            {[0, 0.9, 1.8].map((o, i) => (
              <mesh key={i} geometry={CYL} material={mat(i % 2 ? '#c9b48a' : '#b69d72')} position={[(i - 1) * 0.5, 0.55, o * 0.3]} scale={[0.5, 1.1, 0.5]} />
            ))}
          </group>
        ))}
      {f === 'aisle' && <mesh geometry={BOX} material={mat(theme.accent)} position={[0, 0.02, 3]} scale={[40, 0.02, 0.4]} />}
    </group>
  )
}

function ShelfUnit({ theme, levels, width }: { theme: StoreTheme; levels: number; width: number }) {
  const f = theme.fixture
  const top = shelfY(0, levels) + 1.9
  const W = width
  const boardMat = mat(theme.shelf, { roughness: f === 'rack' || f === 'chilled' ? 0.35 : 0.8, metalness: f === 'rack' ? 0.3 : 0.05 })
  const tilt = f === 'market' ? -0.12 : 0

  return (
    <group>
      {/* back panel */}
      <mesh geometry={BOX} material={mat(f === 'chilled' ? '#dfe8e7' : f === 'pantry' ? '#6f4a2c' : f === 'market' ? '#8a6a4d' : theme.shelf, { roughness: 0.9 })} position={[0, top / 2, -0.55]} scale={[W, top, 0.12]} />
      {/* boards */}
      {Array.from({ length: levels }, (_, l) => (
        <mesh key={l} geometry={BOX} material={boardMat} position={[0, shelfY(l, levels) - 0.06, 0.05]} rotation={[tilt, 0, 0]} scale={[W, 0.12, f === 'market' ? 1.5 : 1.25]} />
      ))}
      {/* uprights */}
      {[-W / 2, W / 2].map((x) => (
        <mesh key={x} geometry={BOX} material={mat(theme.trim)} position={[x, top / 2, 0]} scale={[f === 'rack' ? 0.08 : 0.18, top, 1.2]} />
      ))}
      {/* header band */}
      <mesh geometry={BOX} material={mat(theme.trim)} position={[0, top + 0.28, -0.1]} scale={[W + 0.4, 0.5, 0.5]} />
      <mesh geometry={BOX} material={mat(theme.accent)} position={[0, top + 0.28, 0.17]} scale={[W + 0.4, 0.14, 0.06]} />

      {f === 'counter' && (
        <>
          <mesh geometry={BOX} material={mat('#8a5a34')} position={[0, 0.35, 0.65]} scale={[W, 0.7, 0.5]} />
          <mesh geometry={BOX} material={mat('#cfe5ec', { transparent: true, opacity: 0.16, roughness: 0.05 })} position={[0, top / 2 + 0.3, 0.78]} scale={[W, top - 0.6, 0.04]} />
          <mesh geometry={BOX} material={glowMat('#ffcf8f', 1.6)} position={[0, top - 0.1, 0.4]} scale={[W - 0.4, 0.05, 0.12]} />
        </>
      )}
      {f === 'chilled' && (
        <>
          <mesh geometry={BOX} material={mat('#cfe5ec', { transparent: true, opacity: 0.14, roughness: 0.05 })} position={[0, top / 2 + 0.2, 0.7]} scale={[W, top, 0.04]} />
          <mesh geometry={BOX} material={glowMat('#bfeaf2', 1.8)} position={[0, top - 0.12, 0.45]} scale={[W - 0.4, 0.05, 0.1]} />
        </>
      )}
      {f === 'market' &&
        [-4, 0, 4].map((x) => <mesh key={x} geometry={BOX} material={mat('#a88257')} position={[x, 0.35, 1.4]} scale={[2.6, 0.7, 1.1]} />)}
    </group>
  )
}

interface Props {
  theme: StoreTheme
  products: ProductView[]
  selectedId: string | null
  hoveredId: string | null
  reducedMotion: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

/** The reusable store environment: a room, a themed shelf unit, and the packs laid out on it. */
export function StoreRoom({ theme, products, selectedId, hoveredId, reducedMotion, onHover, onSelect }: Props) {
  const { slots, levels, width } = useMemo(() => layoutShelf(products.length), [products.length])
  return (
    <group>
      <Room theme={theme} />
      <ShelfUnit theme={theme} levels={levels} width={width} />
      {products.map((p, i) => (
        <PackMesh
          key={p.id}
          product={p}
          x={slots[i].x}
          y={slots[i].y}
          index={i}
          hovered={hoveredId === p.id}
          selected={selectedId === p.id}
          reducedMotion={reducedMotion}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
    </group>
  )
}
