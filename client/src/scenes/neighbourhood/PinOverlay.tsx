import { useEffect, useRef } from 'react'
import { useDiscovery } from '@/store/discovery'
import { useIsSmall } from '@/hooks/useDevice'
import { useStores } from '@/store/stores'
import { StorePin } from './StorePin'
import { pinPositions } from './pinProjection'

/**
 * Real DOM buttons positioned over the canvas. They are focusable and announced by screen readers,
 * and live outside the WebGL tree so unmounting the 3D view can never disturb them.
 */
export function PinOverlay({ visibleIds }: { visibleIds: Set<string> }) {
  const hoveredId = useDiscovery((s) => s.hoveredId)
  const selectedId = useDiscovery((s) => s.selectedId)
  const hover = useDiscovery((s) => s.hover)
  const select = useDiscovery((s) => s.select)
  const stores = useStores((s) => s.stores)
  const compact = useIsSmall()
  const refs = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    let raf = 0
    const tick = () => {
      refs.current.forEach((el, id) => {
        const p = pinPositions.get(id)
        if (!p || !p.visible) {
          el.style.visibility = 'hidden'
          return
        }
        el.style.visibility = 'visible'
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -100%)`
        el.style.zIndex = String(Math.round((1 - p.depth) * 1000))
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {stores.map((store) => {
        const hovered = hoveredId === store.id
        const selected = selectedId === store.id
        return (
          <div
            key={store.id}
            ref={(el) => {
              if (el) refs.current.set(store.id, el)
              else refs.current.delete(store.id)
            }}
            className="absolute left-0 top-0"
            style={{ visibility: 'hidden', willChange: 'transform', zIndex: hovered || selected ? 2000 : undefined }}
          >
            <StorePin
              store={store}
              hovered={hovered}
              selected={selected}
              dimmed={!visibleIds.has(store.id)}
              compact={compact}
              onHover={hover}
              onSelect={select}
            />
          </div>
        )
      })}
    </div>
  )
}
