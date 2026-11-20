import { useT } from '@/services/i18n'

interface Props {
  qty: number
  max: number
  name: string
  onChange: (qty: number) => void
  /** Smaller variant for dense rows. */
  compact?: boolean
}

/** − qty +. Going below 1 removes the line. The + stops at the stock the server says is sellable. */
export function QtyStepper({ qty, max, name, onChange, compact = false }: Props) {
  const t = useT()
  const atMax = qty >= max
  const btn = `grid place-items-center border border-forest/30 text-forest transition-colors hover:bg-forest hover:text-cream disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-forest ${compact ? 'h-9 w-9' : 'h-11 w-11'}`
  return (
    <div className="inline-flex items-center" role="group" aria-label={`${t('qty')}: ${name}`}>
      <button type="button" className={btn} aria-label={t('decreaseQty', { name })} onClick={() => onChange(qty - 1)}>
        <span aria-hidden>−</span>
      </button>
      <span className={`grid place-items-center border-y border-forest/30 bg-white tabular-nums ${compact ? 'h-9 min-w-9 text-[0.85rem]' : 'h-11 min-w-11 text-[0.95rem]'}`} aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className={btn}
        aria-label={atMax ? t('noMoreStock') : t('increaseQty', { name })}
        title={atMax ? t('noMoreStock') : undefined}
        disabled={atMax}
        onClick={() => onChange(qty + 1)}
      >
        <span aria-hidden>+</span>
      </button>
    </div>
  )
}
