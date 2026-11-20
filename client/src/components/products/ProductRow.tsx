import { Link } from 'react-router-dom'
import { formatPaise, type ProductView, type Localised } from '@thulir/shared'
import { pick, useLang, useT } from '@/services/i18n'
import { ProductImage } from './ProductImage'
import { FreshnessChip, VegMark } from './ProductCard'

interface Props {
  product: ProductView
  store: { slug: string; name: Localised }
  /** Extra line under the store name, e.g. "20 min". */
  meta?: string
  deliverable?: boolean
}

/** A product as a result row: art, name, price, freshness, and a link into its store. Used by search and missions. */
export function ProductRow({ product: p, store, meta, deliverable = true }: Props) {
  const t = useT()
  const lang = useLang()
  return (
    <li className="border-b border-line">
      <Link
        to={`/store/${store.slug}?product=${p.id}`}
        className="flex items-center gap-3 px-1 py-3 hover:bg-limestone/60 sm:gap-4"
        aria-label={`${pick(p.name, lang)}, ${p.brand}, ${p.unit}, ${formatPaise(p.pricePaise)}, ${pick(store.name, lang)}`}
      >
        <ProductImage product={p} className="h-16 w-16 shrink-0 bg-cream sm:h-20 sm:w-20" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[0.75rem] text-charcoal/65">
            <VegMark veg={p.veg} />
            <span className="truncate">{p.brand} · {p.unit}</span>
          </span>
          <span className="block font-display text-[1.05rem] leading-snug text-forest">{pick(p.name, lang)}</span>
          <span className="mt-0.5 block truncate text-[0.78rem] text-charcoal/70">
            {pick(store.name, lang)}
            {meta ? ` · ${meta}` : ''}
            {!deliverable ? ` · ${t('notDeliverable')}` : ''}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-display text-[1.1rem] text-forest">{formatPaise(p.pricePaise)}</span>
          {p.discountPercent > 0 && <span className="text-[0.7rem] text-charcoal/55 line-through">{formatPaise(p.mrpPaise)}</span>}
          <FreshnessChip product={p} />
        </span>
      </Link>
    </li>
  )
}
