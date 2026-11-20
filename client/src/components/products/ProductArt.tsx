import type { PackShape } from '@thulir/shared'

interface Props {
  shape: PackShape
  color: string
  brand: string
  /** Accessible name. Omit when the product name is already rendered next to the art. */
  label?: string
  className?: string
}

const INK = '#202522'
const CREAM = '#f5f2ea'

/** A slightly darker shade for sides and lids, computed without a colour library. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))))
  const r = f((n >> 16) & 255)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * Stylised pack illustration generated from the product's shape, colour and brand initial. These are illustrative
 * placeholders, not photographs — real photos arrive through the owner portal's image upload.
 */
export function ProductArt({ shape, color, brand, label, className }: Props) {
  const dark = shade(color, -0.22)
  const light = shade(color, 0.18)
  const initial = (brand.trim()[0] ?? '?').toUpperCase()
  const a11y = label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true as const }

  const labelPanel = (x: number, y: number, w: number, h: number) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx="3" fill={CREAM} />
      <text x={x + w / 2} y={y + h / 2 + 7} textAnchor="middle" fontSize="20" fontWeight="700" fill={INK} fontFamily="Georgia, serif">
        {initial}
      </text>
    </>
  )

  let body: React.ReactNode
  switch (shape) {
    case 'bottle':
      body = (
        <>
          <rect x="50" y="14" width="20" height="10" rx="2" fill={INK} />
          <path d="M52 24h16v14c0 6 10 10 10 22v46a6 6 0 0 1-6 6H48a6 6 0 0 1-6-6V60c0-12 10-16 10-22V24Z" fill={color} />
          <path d="M52 24h6v84h-6z" fill={light} opacity=".35" />
          {labelPanel(46, 62, 28, 30)}
        </>
      )
      break
    case 'jar':
      body = (
        <>
          <rect x="34" y="26" width="52" height="14" rx="4" fill={dark} />
          <rect x="30" y="40" width="60" height="68" rx="9" fill={color} />
          <rect x="36" y="42" width="7" height="62" rx="3" fill={light} opacity=".4" />
          {labelPanel(40, 56, 40, 34)}
        </>
      )
      break
    case 'pouch':
      body = (
        <>
          <path d="M30 24h60l5 10-3 66a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6l-3-66 5-10Z" fill={color} />
          <path d="M30 24h60" stroke={dark} strokeWidth="5" strokeLinecap="round" />
          <path d="M30 100h60" stroke={dark} strokeWidth="3" opacity=".5" />
          {labelPanel(40, 48, 40, 38)}
        </>
      )
      break
    case 'carton':
      body = (
        <>
          <path d="M38 22l22-8 22 8v8H38z" fill={dark} />
          <rect x="38" y="30" width="44" height="78" rx="3" fill={color} />
          <rect x="38" y="30" width="9" height="78" fill={light} opacity=".3" />
          {labelPanel(44, 52, 32, 36)}
        </>
      )
      break
    case 'tub':
      body = (
        <>
          <rect x="26" y="44" width="68" height="12" rx="5" fill={dark} />
          <path d="M30 56h60l-6 48a6 6 0 0 1-6 5H42a6 6 0 0 1-6-5l-6-48Z" fill={color} />
          {labelPanel(42, 66, 36, 28)}
        </>
      )
      break
    case 'bar':
      body = (
        <>
          <rect x="22" y="48" width="76" height="40" rx="5" fill={color} />
          <rect x="22" y="48" width="76" height="9" rx="4" fill={light} opacity=".4" />
          {labelPanel(34, 56, 52, 26)}
        </>
      )
      break
    case 'crate':
      body = (
        <>
          {[38, 56, 74, 47, 65].map((cx, i) => (
            <circle key={i} cx={cx} cy={i < 3 ? 56 : 44} r="11" fill={i % 2 ? light : color} />
          ))}
          <path d="M20 62h80l-6 40H26z" fill="#a88257" />
          <path d="M22 74h76M24 88h72" stroke="#6f5436" strokeWidth="2.5" />
          <rect x="20" y="58" width="80" height="6" rx="2" fill="#8a6a4d" />
        </>
      )
      break
    case 'box':
    default:
      body = (
        <>
          <rect x="30" y="26" width="60" height="82" rx="4" fill={color} />
          <path d="M30 26l8-8h52l-8 8z" fill={light} opacity=".55" />
          <rect x="82" y="26" width="8" height="82" fill={dark} opacity=".35" />
          {labelPanel(38, 50, 38, 40)}
        </>
      )
  }

  return (
    <svg viewBox="0 0 120 120" className={className} {...a11y}>
      <ellipse cx="60" cy="110" rx="34" ry="4.5" fill="#202522" opacity=".14" />
      {body}
    </svg>
  )
}
