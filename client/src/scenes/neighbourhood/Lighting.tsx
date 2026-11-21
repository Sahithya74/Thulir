import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, type DirectionalLight, type HemisphereLight } from 'three'
import gsap from 'gsap'
import { dur } from '@/services/motion'

export type LightMode = 'golden' | 'day'

const MODES = {
  // Opening shot: low, warm sun.
  golden: { sun: '#ffd9ae', sunI: 2.6, pos: [34, 18, 20], sky: '#ffe9d2', hemiI: 0.8, bg: '#f6dcc2' },
  // Settled daylight: higher, neutral sun.
  day: { sun: '#fff4df', sunI: 2.3, pos: [22, 36, 16], sky: '#fff1dc', hemiI: 1.0, bg: '#f1dcc0' },
} as const

interface Props {
  mode: LightMode
  shadows: boolean
  low: boolean
}

/** Sun + hemisphere rig whose colour/angle tween between modes (the "lighting transition"). */
export function Lighting({ mode, shadows, low }: Props) {
  const sun = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const { scene, invalidate } = useThree()
  const state = useRef({ sunI: MODES.golden.sunI, hemiI: MODES.golden.hemiI, pos: [...MODES.golden.pos] as number[] })
  const colors = useRef({ sun: new Color(MODES.golden.sun), sky: new Color(MODES.golden.sky), bg: new Color(MODES.golden.bg) })

  const apply = () => {
    const s = state.current
    if (sun.current) {
      sun.current.color.copy(colors.current.sun)
      sun.current.intensity = s.sunI
      sun.current.position.set(s.pos[0], s.pos[1], s.pos[2])
    }
    if (hemi.current) {
      hemi.current.color.copy(colors.current.sky)
      hemi.current.intensity = s.hemiI
    }
    if (scene.background instanceof Color) scene.background.copy(colors.current.bg)
    if (scene.fog) scene.fog.color.copy(colors.current.bg)
    invalidate()
  }

  useEffect(() => {
    const m = MODES[mode]
    const d = dur(mode === 'day' ? 4 : 0)
    apply()
    const tweens = [
      gsap.to(state.current, { sunI: m.sunI, hemiI: m.hemiI, duration: d, ease: 'power2.inOut', onUpdate: apply }),
      gsap.to(state.current.pos, { 0: m.pos[0], 1: m.pos[1], 2: m.pos[2], duration: d, ease: 'power2.inOut' }),
      gsap.to(colors.current.sun, { r: new Color(m.sun).r, g: new Color(m.sun).g, b: new Color(m.sun).b, duration: d }),
      gsap.to(colors.current.sky, { r: new Color(m.sky).r, g: new Color(m.sky).g, b: new Color(m.sky).b, duration: d }),
      gsap.to(colors.current.bg, { r: new Color(m.bg).r, g: new Color(m.bg).g, b: new Color(m.bg).b, duration: d }),
    ]
    return () => tweens.forEach((t) => t.kill())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return (
    <>
      <hemisphereLight ref={hemi} args={['#ffe9d2', '#9fc9b8', MODES.golden.hemiI]} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        intensity={MODES.golden.sunI}
        position={[34, 18, 20]}
        shadow-mapSize={low ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  )
}
