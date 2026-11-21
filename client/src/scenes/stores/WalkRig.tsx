import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { MathUtils } from 'three'
import { dur } from '@/services/motion'
import { EYE_Y, clamp, nearestFace, resolve, route, standFor, standForFace, type WalkPlan } from './walkLayout'
import { walkCmd, walkInput, walkPose } from './walkBus'

const SPEED = 7.5
const TURN = 1.9

interface Props {
  plan: WalkPlan
  selectedId: string | null
  reducedMotion: boolean
  onNearDept: (dept: string | null) => void
}

/**
 * First-person camera for the walk-in store. WASD / arrows / d-pad move, dragging looks around, the wheel steps
 * forward and back, a click on the floor walks there (round the aisle ends if need be), and choosing a product
 * walks up to it and frames it.
 */
export function WalkRig({ plan, selectedId, reducedMotion, onNearDept }: Props) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const s = useRef({ x: plan.spawn.x, z: plan.depth + 8, yaw: 0, pitch: -0.04, bob: 0, moving: 0 })
  const keys = useRef(new Set<string>())
  const tween = useRef<gsap.core.Timeline | null>(null)
  const lastDept = useRef<string | null>(null)
  const clock = useRef(0)

  const cancel = () => {
    tween.current?.kill()
    tween.current = null
  }

  const glideTo = useMemo(
    () => (pts: { x: number; z: number }[], end?: { yaw: number; pitch: number }, speed = 11) => {
      cancel()
      const st = s.current
      const tl = gsap.timeline()
      let px = st.x
      let pz = st.z
      const total = pts.reduce((a, p) => {
        const d = Math.hypot(p.x - px, p.z - pz)
        px = p.x
        pz = p.z
        return a + d
      }, 0)
      const d = dur(Math.min(4.2, Math.max(0.9, total / speed)))
      px = st.x
      pz = st.z
      pts.forEach((p, i) => {
        const seg = Math.hypot(p.x - px, p.z - pz)
        px = p.x
        pz = p.z
        tl.to(st, { x: p.x, z: p.z, duration: d * (seg / Math.max(total, 0.01)), ease: pts.length === 1 ? 'power2.inOut' : i === 0 ? 'power1.in' : i === pts.length - 1 ? 'power1.out' : 'none' })
      })
      if (end) {
        // turn to the target heading by the shortest way round
        let dy = end.yaw - st.yaw
        dy = Math.atan2(Math.sin(dy), Math.cos(dy))
        tl.to(st, { yaw: st.yaw + dy, pitch: end.pitch, duration: d * 0.8, ease: 'power2.inOut' }, 0)
      } else {
        tl.to(st, { pitch: -0.05, duration: d * 0.5 }, 0)
      }
      tween.current = tl
      if (d === 0) tl.progress(1)
    },
    [],
  )

  // opening shot: walk in through the door
  useEffect(() => {
    glideTo([{ x: plan.spawn.x, z: plan.spawn.z }], { yaw: 0, pitch: -0.04 }, 6)
    return cancel
  }, [plan, glideTo])

  // commands from the d-pad, minimap and department chips
  useEffect(
    () =>
      walkCmd.on((c) => {
        const st = s.current
        if (c.type === 'entrance') glideTo(route(plan, st, plan.spawn), { yaw: 0, pitch: -0.04 })
        else if (c.type === 'point') glideTo(route(plan, st, c))
        else if (c.type === 'dept') {
          const fi = plan.deptFace.get(c.dept as never)
          if (fi === undefined) return
          const p = standForFace(plan, fi)
          glideTo(route(plan, st, p), { yaw: p.yaw, pitch: p.pitch })
        } else if (c.type === 'product') {
          const p = standFor(plan, c.id)
          if (p) glideTo(route(plan, st, p), { yaw: p.yaw, pitch: p.pitch })
        }
      }),
    [plan, glideTo],
  )

  // selecting a product (from anywhere) walks to it
  useEffect(() => {
    if (selectedId) walkCmd.emit({ type: 'product', id: selectedId })
  }, [selectedId])

  // keyboard
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e'].includes(k)) {
        keys.current.add(k)
        cancel()
        if (k.startsWith('arrow')) e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // drag to look, wheel to step
  useEffect(() => {
    const el = gl.domElement
    let id: number | null = null
    let lx = 0
    let ly = 0
    const down = (e: PointerEvent) => {
      id = e.pointerId
      lx = e.clientX
      ly = e.clientY
    }
    const move = (e: PointerEvent) => {
      if (id !== e.pointerId) return
      const dx = e.clientX - lx
      const dy = e.clientY - ly
      lx = e.clientX
      ly = e.clientY
      if (Math.abs(dx) + Math.abs(dy) < 1) return
      cancel()
      s.current.yaw -= dx * 0.0055
      s.current.pitch = clamp(s.current.pitch - dy * 0.0045, -0.85, 0.85)
    }
    const end = (e: PointerEvent) => {
      if (id === e.pointerId) id = null
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      cancel()
      const st = s.current
      const step = clamp(-e.deltaY * 0.012, -3, 3)
      const p = resolve(plan, st.x - Math.sin(st.yaw) * step, st.z - Math.cos(st.yaw) * step)
      st.x = p.x
      st.z = p.z
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl, plan])

  useFrame((state, delta) => {
    const st = s.current
    const k = keys.current
    const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0) + walkInput.fwd
    const strafe = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0) + walkInput.strafe
    const turn = (k.has('q') || k.has('arrowleft') ? 1 : 0) - (k.has('e') || k.has('arrowright') ? 1 : 0) + walkInput.turn
    if (walkInput.fwd || walkInput.strafe || walkInput.turn) cancel()
    if (turn) st.yaw += turn * TURN * delta
    let moving = 0
    if (fwd || strafe) {
      const len = Math.hypot(fwd, strafe) || 1
      const sx = Math.cos(st.yaw)
      const sz = -Math.sin(st.yaw)
      const dx = (-Math.sin(st.yaw) * fwd + sx * strafe) / len
      const dz = (-Math.cos(st.yaw) * fwd + sz * strafe) / len
      const p = resolve(plan, st.x + dx * SPEED * delta, st.z + dz * SPEED * delta)
      st.x = p.x
      st.z = p.z
      moving = 1
    }
    if (tween.current?.isActive()) {
      const p = resolve(plan, st.x, st.z)
      // outside during the walk-in, otherwise keep inside the shop
      if (st.z <= plan.depth - 1.2) {
        st.x = p.x
        st.z = p.z
      }
      moving = 1
    }
    st.moving = MathUtils.damp(st.moving, moving, 8, delta)
    st.bob += delta * 9 * st.moving
    const bob = reducedMotion ? 0 : Math.sin(st.bob) * 0.06 * st.moving
    const sway = reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.5) * 0.006
    camera.position.set(st.x, EYE_Y + bob, st.z)
    camera.rotation.set(st.pitch, st.yaw + sway, 0, 'YXZ')

    walkPose.x = st.x
    walkPose.z = st.z
    walkPose.yaw = st.yaw
    clock.current += delta
    if (clock.current > 0.25) {
      clock.current = 0
      const f = nearestFace(plan, st.x, st.z, st.yaw)
      const dept = f?.dept ?? null
      walkPose.dept = dept
      if (dept !== lastDept.current) {
        lastDept.current = dept
        onNearDept(dept)
      }
    }
  })

  return null
}
