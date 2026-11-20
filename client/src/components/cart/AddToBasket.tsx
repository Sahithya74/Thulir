import { MAX_LINE_QTY, type ProductView } from '@thulir/shared'
import { pick, useLang, useT } from '@/services/i18n'
import { useCart } from '@/store/cart'
import { flyToBasket } from './flyToBasket'
import { QtyStepper } from './QtyStepper'

interface Props {
  product: ProductView
  /** `lg` is the full-width control in the product panel. */
  size?: 'sm' | 'lg'
}

/** Add / quantity control. Quantity is capped at what the server says is sellable right now. */
export function AddToBasket({ product: p, size = 'sm' }: Props) {
  const t = useT()
  const lang = useLang()
  const qty = useCart((s) => s.lines.find((l) => l.productId === p.id)?.qty ?? 0)
  const add = useCart((s) => s.add)
  const setQty = useCart((s) => s.setQty)
  const announce = useCart((s) => s.announce)
  const name = pick(p.name, lang)
  const max = Math.min(MAX_LINE_QTY, p.eligibility.sellableQty)

  if (!p.eligibility.sellable) {
    return (
      <button type="button" disabled aria-disabled className={`tap w-full border border-forest/20 bg-limestone px-3 text-[0.82rem] text-forest/55 ${size === 'lg' ? 'text-[0.9rem]' : ''}`}>
        {t('outOfStock')}
      </button>
    )
  }

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={(e) => {
          add(p.id)
          announce(t('addedToBasket', { name }))
          flyToBasket(e.currentTarget)
        }}
        className={`tap w-full border border-forest bg-forest px-3 font-medium text-cream transition-colors hover:bg-charcoal ${size === 'lg' ? 'text-[0.95rem]' : 'text-[0.82rem]'}`}
      >
        {size === 'lg' ? t('addToBasket') : `+ ${t('addShort')}`}
      </button>
    )
  }

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <QtyStepper
        qty={qty}
        max={max}
        name={name}
        compact={size === 'sm'}
        onChange={(n) => {
          setQty(p.id, n)
          if (n < 1) announce(t('removedFromBasket', { name }))
        }}
      />
      <span className="text-[0.72rem] text-olive">{qty >= max ? t('noMoreStock') : ''}</span>
    </div>
  )
}
