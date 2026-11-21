import { useRef } from 'react'
import { formatPaise, type ProductView } from '@thulir/shared'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { pick, useLang, useT } from '@/services/i18n'
import { AddToBasket } from '@/components/cart/AddToBasket'
import { ProductImage } from './ProductImage'
import { describeFreshness, type Tone } from './freshness'

const TONE: Record<Tone, string> = {
  ok: 'text-olive',
  warn: 'text-terracotta',
  muted: 'text-charcoal/55',
}

export function FreshnessChip({ product }: { product: ProductView }) {
  const t = useT()
  const lang = useLang()
  const f = describeFreshness(product.eligibility, lang, t)
  return (
    <span className={`inline-flex items-center gap-1.5 text-[0.72rem] font-medium ${TONE[f.tone]}`}>
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {f.chip}
    </span>
  )
}

export function VegMark({ veg }: { veg: boolean }) {
  const t = useT()
  const c = veg ? '#3f7a3a' : '#b8322a'
  return (
    <span role="img" aria-label={veg ? t('vegetarian') : t('nonVegetarian')} className="inline-grid h-3.5 w-3.5 place-items-center border" style={{ borderColor: c }}>
      <span className="block h-1.5 w-1.5 rounded-full" style={{ background: c }} />
    </span>
  )
}

export function Price({ product, large = false }: { product: ProductView; large?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={`font-display text-forest ${large ? 'text-[1.7rem]' : 'text-[1.1rem]'}`}>{formatPaise(product.pricePaise)}</span>
      {product.discountPercent > 0 && <span className="text-[0.75rem] text-charcoal/55 line-through">{formatPaise(product.mrpPaise)}</span>}
    </span>
  )
}

export type CardVariant = 'tile' | 'feature' | 'wide'

interface Props {
  product: ProductView
  selected: boolean
  hovered?: boolean
  onSelect: (id: string) => void
  onHover?: (id: string | null) => void
  /** Bento size: a normal tile, a 2x2 feature, or a wide strip. */
  variant?: CardVariant
}

/**
 * One product, as a spatial card: it tilts toward the pointer while the pack, price and badge sit on separate
 * depth layers. A real button underneath: keyboard focusable, announced with its price and availability.
 */
export function ProductCard({ product: p, selected, hovered, onSelect, onHover, variant = 'tile' }: Props) {
  const t = useT()
  const lang = useLang()
  const reduced = useReducedMotion()
  const card = useRef<HTMLDivElement>(null)
  const sold = !p.eligibility.sellable
  const big = variant === 'feature'
  const wide = variant === 'wide'

  const onMove = (e: React.PointerEvent) => {
    const el = card.current
    if (!el || reduced || e.pointerType === 'touch') return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `perspective(900px) rotateX(${(-py * 9).toFixed(2)}deg) rotateY(${(px * 11).toFixed(2)}deg) translateZ(0)`
    el.style.setProperty('--gx', `${(px + 0.5) * 100}%`)
    el.style.setProperty('--gy', `${(py + 0.5) * 100}%`)
  }
  const onLeave = () => {
    const el = card.current
    if (el) el.style.transform = ''
  }

  const tint = `color-mix(in srgb, ${p.color || '#f5b82e'} 20%, #fffaf0)`
  return (
    <div
      ref={card}
      data-product-card
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ background: selected ? undefined : tint }}
      className={`group relative flex h-full flex-col rounded-[1.6rem] border text-left shadow-[0_12px_28px_-18px_rgba(43,26,18,0.5)] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:shadow-[0_24px_44px_-20px_rgba(43,26,18,0.55)] [transform-style:preserve-3d] ${
        selected ? 'border-terracotta bg-limestone' : hovered ? 'border-forest/40' : 'border-forest/10'
      } ${sold ? 'opacity-80 saturate-50' : ''}`}
    >
      {/* soft light that follows the pointer */}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[1.6rem] opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ background: 'radial-gradient(260px circle at var(--gx,50%) var(--gy,30%), rgba(255,255,255,0.55), transparent 60%)' }} />
      <button
        type="button"
        onClick={() => onSelect(p.id)}
        onMouseEnter={() => onHover?.(p.id)}
        onMouseLeave={() => onHover?.(null)}
        onFocus={() => onHover?.(p.id)}
        onBlur={() => onHover?.(null)}
        aria-pressed={selected}
        aria-label={`${pick(p.name, lang)}, ${p.brand}, ${p.unit}, ${formatPaise(p.pricePaise)}${sold ? `, ${t('outOfStock')}` : ''}`}
        className={`flex flex-1 text-left [transform-style:preserve-3d] ${wide ? 'sm:flex-row' : 'flex-col'}`}
      >
        <div className={`relative grid w-full place-items-center [transform-style:preserve-3d] ${big ? 'min-h-[15rem] flex-1' : wide ? 'aspect-[4/3] sm:aspect-auto sm:w-2/5' : 'aspect-[4/3]'}`}>
          <div className="grid h-full w-full place-items-center transition-transform duration-300 ease-out [transform:translateZ(46px)] group-hover:[transform:translateZ(70px)_scale(1.06)]">
            <ProductImage product={p} size={big ? 300 : 220} className={big ? 'h-[82%] w-auto max-w-[85%]' : 'h-[76%] w-auto max-w-[85%]'} />
          </div>
          {p.discountPercent > 0 && !sold && (
            <span className="absolute left-3 top-3 rounded-full bg-terracotta px-2.5 py-0.5 text-[0.68rem] font-bold text-white shadow [transform:translateZ(60px)]">{t('savePct', { pct: p.discountPercent })}</span>
          )}
          {p.isNew && <span className="absolute right-3 top-3 rounded-full bg-olive px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-white [transform:translateZ(60px)]">New</span>}
        </div>
        <div className={`flex flex-col gap-1 p-3.5 ${wide ? 'sm:flex-1 sm:justify-center' : 'flex-1'}`}>
          <div className="flex items-center gap-1.5 text-[0.72rem] text-charcoal/65">
            <VegMark veg={p.veg} />
            <span className="truncate">{p.brand}</span>
          </div>
          <h3 className={`font-display leading-snug text-forest ${big ? 'text-[1.55rem]' : 'text-[1.02rem]'}`}>{pick(p.name, lang)}</h3>
          <p className="text-[0.78rem] text-charcoal/65">{p.unit}</p>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1 pt-2">
            <Price product={p} large={big} />
            <FreshnessChip product={p} />
          </div>
        </div>
      </button>
      <div className="border-t border-forest/10 bg-white/50 p-2">
        <AddToBasket product={p} />
      </div>
    </div>
  )
}
