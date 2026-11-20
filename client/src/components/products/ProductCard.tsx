import { formatPaise, type ProductView } from '@thulir/shared'
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
  const c = veg ? '#5c7a3e' : '#9a3b2c'
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

interface Props {
  product: ProductView
  selected: boolean
  hovered?: boolean
  onSelect: (id: string) => void
  onHover?: (id: string | null) => void
}

/** One product in the list/grid view. A real button: keyboard focusable, announced with its price and availability. */
export function ProductCard({ product: p, selected, hovered, onSelect, onHover }: Props) {
  const t = useT()
  const lang = useLang()
  const sold = !p.eligibility.sellable
  return (
    <div
      data-product-card
      className={`group relative flex h-full flex-col border text-left transition-colors ${
        selected ? 'border-forest bg-limestone' : hovered ? 'border-forest/50 bg-limestone/60' : 'border-line bg-white hover:border-forest/40'
      } ${sold ? 'opacity-80' : ''}`}
    >
      <button
        type="button"
        onClick={() => onSelect(p.id)}
        onMouseEnter={() => onHover?.(p.id)}
        onMouseLeave={() => onHover?.(null)}
        onFocus={() => onHover?.(p.id)}
        onBlur={() => onHover?.(null)}
        aria-pressed={selected}
        aria-label={`${pick(p.name, lang)}, ${p.brand}, ${p.unit}, ${formatPaise(p.pricePaise)}${sold ? `, ${t('outOfStock')}` : ''}`}
        className="flex flex-1 flex-col text-left"
      >
        <div className="relative grid aspect-[4/3] w-full place-items-center bg-cream">
          <ProductImage product={p} className="h-[78%] w-auto max-w-[85%]" />
          {p.discountPercent > 0 && !sold && (
            <span className="absolute left-0 top-2 bg-terracotta px-2 py-0.5 text-[0.68rem] font-semibold text-white">{t('savePct', { pct: p.discountPercent })}</span>
          )}
          {p.isNew && <span className="absolute right-2 top-2 border border-olive px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-olive">New</span>}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <div className="flex items-center gap-1.5 text-[0.72rem] text-charcoal/65">
            <VegMark veg={p.veg} />
            <span className="truncate">{p.brand}</span>
          </div>
          <h3 className="font-display text-[1rem] leading-snug text-forest">{pick(p.name, lang)}</h3>
          <p className="text-[0.78rem] text-charcoal/65">{p.unit}</p>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1 pt-2">
            <Price product={p} />
            <FreshnessChip product={p} />
          </div>
        </div>
      </button>
      <div className="border-t border-line p-2">
        <AddToBasket product={p} />
      </div>
    </div>
  )
}
