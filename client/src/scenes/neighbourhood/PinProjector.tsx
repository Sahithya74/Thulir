import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import { pinPositions } from './pinProjection'
import { plots } from './layout'

/** Projects each store's anchor point to screen space every rendered frame. Renders nothing. */
export function PinProjector() {
  const anchors = useMemo(() => plots.map((p) => ({ id: p.storeId, v: new Vector3(p.x, p.h + 2.6, p.z) })), [])
  const tmp = useMemo(() => new Vector3(), [])

  useEffect(
    () => () => {
      pinPositions.clear()
    },
    [],
  )

  useFrame(({ camera, size }) => {
    for (const a of anchors) {
      tmp.copy(a.v).project(camera)
      const visible = tmp.z > -1 && tmp.z < 1
      pinPositions.set(a.id, {
        x: (tmp.x * 0.5 + 0.5) * size.width,
        y: (-tmp.y * 0.5 + 0.5) * size.height,
        depth: tmp.z,
        visible,
      })
    }
  })
  return null
}
