import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { useDiscovery } from '@/store/discovery'
import { useStores } from '@/store/stores'
import { useT } from '@/services/i18n'
import type { QualityTier } from '@/hooks/useDevice'
import { CameraRig } from './CameraRig'
import { CityBlocks } from './CityBlocks'
import { District } from './District'
import { Lighting, type LightMode } from './Lighting'
import { PinProjector } from './PinProjector'
import { StoreBuilding } from './StoreBuilding'
import { Vehicles } from './Ambient'
import { Birds, Clouds, Pedestrians } from './Life'
import { plots } from './layout'

interface Props {
  /** Ids of stores that pass the current filters; others are dimmed. */
  visibleIds: Set<string>
  reducedMotion: boolean
  tier: QualityTier
}

function Scene({ visibleIds, reducedMotion, tier }: Props) {
  const stores = useStores((s) => s.stores)
  const hoveredId = useDiscovery((s) => s.hoveredId)
  const selectedId = useDiscovery((s) => s.selectedId)
  const hover = useDiscovery((s) => s.hover)
  const select = useDiscovery((s) => s.select)
  const [mode, setMode] = useState<LightMode>('golden')
  const low = tier === 'low'
  const shadows = !low

  // Golden-hour opening settles into daylight while the camera descends.
  useEffect(() => {
    setMode('day')
  }, [])

  return (
    <>
      <color attach="background" args={['#f6dcc2']} />
      <fog attach="fog" args={['#f6dcc2', 150, 380]} />
      <Lighting mode={mode} shadows={shadows} low={low} />
      <CameraRig reducedMotion={reducedMotion} parallax={!low} />
      <PinProjector />
      <District shadows={shadows} />
      <CityBlocks low={low} shadows={shadows} />
      <Vehicles count={low ? 5 : 12} reducedMotion={reducedMotion} />
      <Pedestrians count={low ? 14 : 34} reducedMotion={reducedMotion} />
      <Clouds reducedMotion={reducedMotion} />
      {!low && <Birds count={7} reducedMotion={reducedMotion} />}
      {plots.map((plot) => {
        const store = stores.find((s) => s.id === plot.storeId)
        if (!store) return null
        return (
          <StoreBuilding
            key={plot.storeId}
            plot={plot}
            store={store}
            hovered={hoveredId === store.id}
            selected={selectedId === store.id}
            dimmed={!visibleIds.has(store.id)}
            shadows={shadows}
            reducedMotion={reducedMotion}
            onHover={hover}
            onSelect={select}
          />
        )
      })}
    </>
  )
}

/** Lazy-loaded 3D district. Default export so React.lazy can pick it up. */
export default function NeighbourhoodCanvas(props: Props) {
  const t = useT()
  const { reducedMotion, tier } = props
  return (
    <Canvas
      aria-label={t('canvasLabel')}
      role="group"
      frameloop={reducedMotion ? 'demand' : 'always'}
      dpr={tier === 'low' ? [1, 1.25] : [1, 1.75]}
      shadows={tier !== 'low'}
      camera={{ fov: 36, near: 0.5, far: 600, position: [0, 120, 140] }}
      gl={{ antialias: tier !== 'low', powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 0.95
        gl.outputColorSpace = SRGBColorSpace
      }}
      style={{ touchAction: 'none' }}
      tabIndex={0}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  )
}
