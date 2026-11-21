import { useEffect, useRef, useState } from 'react'
import type { WalkPlan } from '@/scenes/stores/walkLayout'
import { walkCmd, walkInput, walkPose } from '@/scenes/stores/walkBus'

/** Live minimap: the shop from above, with the shopper's position and view cone. Tap it to walk somewhere. */
export function MiniMap({ plan, accent, label }: { plan: WalkPlan; accent: string; label: string }) {
  const [pose, setPose] = useState({ x: plan.spawn.x, z: plan.spawn.z, yaw: 0 })
  useEffect(() => {
    const id = window.setInterval(() => {
      setPose((p) => (Math.abs(p.x - walkPose.x) + Math.abs(p.z - walkPose.z) + Math.abs(p.yaw - walkPose.yaw) < 0.01 ? p : { x: walkPose.x, z: walkPose.z, yaw: walkPose.yaw }))
    }, 90)
    return () => window.clearInterval(id)
  }, [])
  const pad = 1
  const vw = plan.width + pad * 2
  const vh = plan.depth + pad * 2
  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * vw - pad - plan.width / 2
    const z = ((e.clientY - r.top) / r.height) * vh - pad
    walkCmd.emit({ type: 'point', x, z })
  }
  const deg = (-pose.yaw * 180) / Math.PI
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-plan.width / 2 - pad} ${-pad} ${vw} ${vh}`}
      onClick={onClick}
      className="w-36 cursor-pointer rounded-md border border-white/40 bg-white/80 shadow-lg backdrop-blur sm:w-44"
    >
      <rect x={-plan.width / 2} y={0} width={plan.width} height={plan.depth} fill="#eef4fa" stroke="#2b1a12" strokeWidth={0.5} />
      {plan.faces
        .filter((f) => f.kind === 'wall')
        .map((f) => (
          <rect key={f.index} x={f.x - f.length / 2} y={0.3} width={f.length} height={1.4} fill="#2b1a12" opacity={0.75} rx={0.3} />
        ))}
      {plan.gondolas.map((g, i) => (
        <rect key={i} x={g.x - g.length / 2} y={g.z - 1.3} width={g.length} height={2.6} fill={accent} opacity={0.85} rx={0.4} />
      ))}
      {plan.counters.map((c, i) => (
        <rect key={i} x={c.x - 2.8} y={c.z - 1} width={5.6} height={2} fill="#2b1a12" opacity={0.5} rx={0.3} />
      ))}
      <rect x={-3.2} y={plan.depth - 0.5} width={6.4} height={1} fill="#38b0e2" />
      <g transform={`translate(${pose.x} ${pose.z}) rotate(${deg})`}>
        <path d="M0 0 L-5 -9 A10 10 0 0 1 5 -9 Z" fill="#d94f2b" opacity={0.28} />
        <circle r={1.5} fill="#d94f2b" stroke="#fff" strokeWidth={0.5} />
      </g>
    </svg>
  )
}

function PadButton({ label, onHold, children }: { label: string; onHold: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onHold(true)
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onContextMenu={(e) => e.preventDefault()}
      className="grid h-11 w-11 touch-none select-none place-items-center rounded-full border border-white/50 bg-forest/80 text-cream shadow-md backdrop-blur active:scale-95 active:bg-terracotta"
    >
      {children}
    </button>
  )
}

/** On-screen movement pad for touch and mouse users. */
export function DPad({ labels }: { labels: { forward: string; back: string; left: string; right: string } }) {
  const held = useRef(walkInput)
  useEffect(
    () => () => {
      held.current.fwd = held.current.strafe = held.current.turn = 0
    },
    [],
  )
  const arrow = (d: string) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  return (
    <div className="grid grid-cols-3 gap-1" role="group" aria-label="Move">
      <span />
      <PadButton label={labels.forward} onHold={(on) => (walkInput.fwd = on ? 1 : 0)}>{arrow('M3 10l5-5 5 5')}</PadButton>
      <span />
      <PadButton label={labels.left} onHold={(on) => (walkInput.turn = on ? 1 : 0)}>{arrow('M10 3l-5 5 5 5')}</PadButton>
      <PadButton label={labels.back} onHold={(on) => (walkInput.fwd = on ? -1 : 0)}>{arrow('M3 6l5 5 5-5')}</PadButton>
      <PadButton label={labels.right} onHold={(on) => (walkInput.turn = on ? -1 : 0)}>{arrow('M6 3l5 5-5 5')}</PadButton>
    </div>
  )
}
