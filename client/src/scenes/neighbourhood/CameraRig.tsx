import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils } from 'three'
import gsap from 'gsap'
import { useDiscovery } from '@/store/discovery'
import { dur, ease } from '@/services/motion'
import { cameraBus } from './cameraBus'
import { enterPose, focusPose, LIMITS, plotByStore, POSES, type CameraPose } from './layout'

interface Props {
  reducedMotion: boolean
  /** Touch devices skip pointer parallax. */
  parallax: boolean
}

const KEYS = ['theta', 'phi', 'radius', 'tx', 'ty', 'tz'] as const

/**
 * Orbit-style camera built by hand so GSAP flights, drag, wheel/pinch zoom and pointer parallax all compose.
 * `goal` is where the camera is heading (GSAP + user input write here); `cur` is what is rendered, damped toward `goal`.
 */
export function CameraRig({ reducedMotion, parallax }: Props) {
  const { camera, gl, invalidate } = useThree()
  const goal = useRef<CameraPose>({ ...(reducedMotion ? POSES.overview : POSES.intro) })
  const cur = useRef<CameraPose>({ ...goal.current })
  const par = useRef({ x: 0, y: 0 })
  const tween = useRef<gsap.core.Tween | null>(null)
  const selectedId = useDiscovery((s) => s.selectedId)
  const firstSelectRun = useRef(true)

  const flyTo = (pose: CameraPose, seconds: number) => {
    tween.current?.kill()
    const d = dur(seconds)
    if (d === 0) {
      Object.assign(goal.current, pose)
      invalidate()
      return
    }
    tween.current = gsap.to(goal.current, { ...pose, duration: d, ease: ease.inOut, onUpdate: invalidate })
  }

  const clampGoal = () => {
    const g = goal.current
    g.radius = MathUtils.clamp(g.radius, LIMITS.minRadius, LIMITS.maxRadius)
    g.phi = MathUtils.clamp(g.phi, LIMITS.minPhi, LIMITS.maxPhi)
  }

  // Opening shot: descend from the aerial to the overview.
  useEffect(() => {
    if (!reducedMotion) flyTo(POSES.overview, 3.2)
    else invalidate()
    return () => {
      tween.current?.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Selection drives the flight into / out of a store.
  useEffect(() => {
    if (firstSelectRun.current) {
      firstSelectRun.current = false
      return
    }
    const plot = selectedId ? plotByStore[selectedId] : null
    flyTo(plot ? focusPose(plot) : POSES.overview, plot ? 1.1 : 1.0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // HTML-control commands.
  useEffect(
    () =>
      cameraBus.subscribe((cmd, arg) => {
        if (cmd === 'zoomIn' || cmd === 'zoomOut') {
          tween.current?.kill()
          goal.current.radius *= cmd === 'zoomIn' ? 0.78 : 1.28
          clampGoal()
          invalidate()
        } else if (cmd === 'reset') {
          useDiscovery.getState().select(null)
          flyTo(POSES.overview, 1.1)
        } else if (cmd === 'enter') {
          const plot = arg ? plotByStore[arg] : undefined
          if (plot) flyTo(enterPose(plot), 0.9)
        } else if (cmd === 'explore') {
          useDiscovery.getState().select(null)
          flyTo(POSES.explore, 1.6)
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Direct manipulation: drag to orbit, wheel / pinch to zoom, arrow keys to nudge.
  useEffect(() => {
    const el = gl.domElement
    const pointers = new Map<number, { x: number; y: number }>()
    let pinchDist = 0

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      const next = { x: e.clientX, y: e.clientY }
      if (pointers.size === 1) {
        tween.current?.kill()
        goal.current.theta -= (next.x - prev.x) * 0.006
        goal.current.phi -= (next.y - prev.y) * 0.005
        clampGoal()
      } else if (pointers.size === 2) {
        pointers.set(e.pointerId, next)
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinchDist > 0) {
          tween.current?.kill()
          goal.current.radius *= pinchDist / d
          clampGoal()
        }
        pinchDist = d
      }
      pointers.set(e.pointerId, next)
      invalidate()
    }
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      pinchDist = 0
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      tween.current?.kill()
      goal.current.radius *= Math.exp(e.deltaY * 0.0011)
      clampGoal()
      invalidate()
    }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select')) return
      const step = 0.12
      if (e.key === 'ArrowLeft') goal.current.theta += step
      else if (e.key === 'ArrowRight') goal.current.theta -= step
      else if (e.key === 'ArrowUp') goal.current.phi -= step
      else if (e.key === 'ArrowDown') goal.current.phi += step
      else return
      e.preventDefault()
      tween.current?.kill()
      clampGoal()
      invalidate()
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('keydown', onKey)
    }
  }, [gl, invalidate])

  useFrame((state, delta) => {
    const g = goal.current
    const c = cur.current
    if (reducedMotion) {
      for (const k of KEYS) c[k] = g[k]
    } else {
      const lambda = 7
      for (const k of KEYS) c[k] = MathUtils.damp(c[k], g[k], lambda, delta)
      if (parallax) {
        par.current.x = MathUtils.damp(par.current.x, state.pointer.x, 3, delta)
        par.current.y = MathUtils.damp(par.current.y, state.pointer.y, 3, delta)
      }
    }
    const theta = c.theta + par.current.x * 0.035
    const phi = MathUtils.clamp(c.phi - par.current.y * 0.02, 0.2, 1.55)
    const sp = Math.sin(phi)
    camera.position.set(
      c.tx + c.radius * sp * Math.sin(theta),
      c.ty + c.radius * Math.cos(phi),
      c.tz + c.radius * sp * Math.cos(theta),
    )
    camera.lookAt(c.tx, c.ty, c.tz)

    // Keep rendering while the camera is still travelling (matters in frameloop="demand").
    if (!reducedMotion) {
      let moving = Math.abs(par.current.x - state.pointer.x) > 0.002 && parallax
      for (const k of KEYS) if (Math.abs(c[k] - g[k]) > 0.001) moving = true
      if (moving) state.invalidate()
    }
  })

  return null
}
