import { useRef } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface Props {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  /** Maximum tilt in degrees. */
  max?: number
}

/** Tilts toward the pointer on a 3D plane; children can sit at different depths with translateZ. */
export function Tilt({ children, className = '', style, max = 10 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const move = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || reduced || e.pointerType === 'touch') return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max * 1.2).toFixed(2)}deg)`
    el.style.setProperty('--px', String(px * 2))
    el.style.setProperty('--py', String(py * 2))
  }
  const leave = () => {
    const el = ref.current
    if (!el) return
    el.style.transform = ''
    el.style.setProperty('--px', '0')
    el.style.setProperty('--py', '0')
  }
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} style={style} className={`transition-transform duration-200 ease-out [transform-style:preserve-3d] ${className}`}>
      {children}
    </div>
  )
}
