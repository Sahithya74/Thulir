import { formatPaise } from '@thulir/shared'
import { useT } from '@/services/i18n'

interface Props {
  subtotalPaise: number
  discountPaise: number
  deliveryPaise: number
  taxPaise: number
  totalPaise: number
  /** MRP minus price across the basket, if known. */
  savingsPaise?: number
}

/** The same breakdown everywhere money is shown: basket, checkout and the confirmation. */
export function CartTotals({ subtotalPaise, discountPaise, deliveryPaise, taxPaise, totalPaise, savingsPaise }: Props) {
  const t = useT()
  const row = 'flex items-baseline justify-between gap-4 py-1 text-[0.88rem]'
  return (
    <dl className="border-t border-line pt-2">
      <div className={row}>
        <dt className="text-charcoal/75">{t('subtotalLabel')}</dt>
        <dd className="tabular-nums">{formatPaise(subtotalPaise)}</dd>
      </div>
      {discountPaise > 0 && (
        <div className={row}>
          <dt className="text-charcoal/75">{t('offersLabel')}</dt>
          <dd className="tabular-nums text-olive">−{formatPaise(discountPaise)}</dd>
        </div>
      )}
      <div className={row}>
        <dt className="text-charcoal/75">{t('deliveryFee')}</dt>
        <dd className="tabular-nums">{deliveryPaise === 0 ? t('freeLabel') : formatPaise(deliveryPaise)}</dd>
      </div>
      <div className={row}>
        <dt className="text-charcoal/75">{t('taxesLabel')}</dt>
        <dd className="text-charcoal/70">{taxPaise === 0 ? t('taxesIncluded') : formatPaise(taxPaise)}</dd>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-forest/30 pt-2">
        <dt className="font-display text-[1.1rem] text-forest">{t('totalLabel')}</dt>
        <dd className="font-display text-[1.4rem] tabular-nums text-forest">{formatPaise(totalPaise)}</dd>
      </div>
      {savingsPaise !== undefined && savingsPaise > 0 && <p className="mt-1 text-right text-[0.75rem] text-olive">{t('savedVsMrp', { amount: formatPaise(savingsPaise) })}</p>}
    </dl>
  )
}
