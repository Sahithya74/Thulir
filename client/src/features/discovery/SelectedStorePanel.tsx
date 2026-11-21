import { useNavigate } from 'react-router-dom'
import { formatPaise, isOpenAt } from '@thulir/shared'
import { TrustBadge } from '@/components/trust/TrustBadge'
import { categoryKey, pick, useLang, useT, type DictKey } from '@/services/i18n'
import { useDiscovery } from '@/store/discovery'
import { useStores } from '@/store/stores'
import { enterStore } from './enterStore'

const FRESH: Record<string, DictKey> = { daily: 'freshnessDaily', weekly: 'freshnessWeekly', unchecked: 'freshnessUnchecked' }

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line pt-2">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 font-display text-[1.25rem] leading-tight text-forest">{value}</dd>
    </div>
  )
}

export function SelectedStorePanel() {
  const t = useT()
  const lang = useLang()
  const nav = useNavigate()
  const selectedId = useDiscovery((s) => s.selectedId)
  const view = useDiscovery((s) => s.view)
  const select = useDiscovery((s) => s.select)
  const store = useStores((s) => s.stores.find((x) => x.id === selectedId))
  if (!store) return null
  const open = isOpenAt(store.hours)
  const { deliverable, etaMin, distanceM } = store.delivery

  return (
    <section
      aria-label={pick(store.name, lang)}
      className="max-h-full w-full overflow-y-auto overscroll-contain border border-line bg-cream p-5 shadow-[0_24px_60px_-28px_rgba(43, 26, 18,0.55)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">{t(categoryKey[store.category])}</div>
          <h2 className="mt-1 font-display text-[1.7rem] leading-[1.1] text-forest">{pick(store.name, lang)}</h2>
        </div>
        <button type="button" onClick={() => select(null)} aria-label={t('backToDiscovery')} className="tap -mr-2 -mt-1 px-2 text-xl text-forest/70 hover:text-forest">
          ×
        </button>
      </div>
      <p className="mt-2 text-[0.9rem] text-charcoal/80">{pick(store.tagline, lang)}</p>

      <p className="mt-3 flex items-center gap-2 text-[0.85rem]">
        <span className={`inline-block h-2 w-2 rounded-full ${open ? 'bg-olive' : 'bg-terracotta'}`} />
        <strong className="font-semibold">{open ? t('open') : t('closed')}</strong>
        <span className="text-charcoal/70">
          · {store.hours.opens}–{store.hours.closes}
        </span>
      </p>

      <p
        className={`mt-3 border-l-2 px-2.5 py-1 text-[0.82rem] ${deliverable ? 'border-olive bg-olive/10 text-forest' : 'border-terracotta bg-terracotta/10 text-forest'}`}
      >
        {deliverable ? t('deliverableHere') : t('notDeliverable')} ·{' '}
        {t('deliveryRadius', { km: (store.deliveryRadiusM / 1000).toFixed(1) })}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">
        <Stat label={t('delivery')} value={deliverable ? `${etaMin} ${t('min')}` : '—'} />
        <Stat label={t('distance')} value={`${(distanceM / 1000).toFixed(1)} km`} />
        <Stat label={t('rating')} value={`★ ${store.rating.toFixed(1)}`} />
        <Stat label={t('deliveryFee')} value={formatPaise(store.deliveryFeePaise)} />
      </dl>
      <p className="mt-3 text-[0.78rem] text-charcoal/70">
        {t('freeAbove', { amount: formatPaise(store.freeDeliveryAbovePaise) })} · {store.reviewCount} {t('reviews')}
      </p>

      {store.offers.length > 0 && (
        <div className="mt-4">
          <div className="eyebrow">{t('offers')}</div>
          <ul className="mt-1.5 space-y-1">
            {store.offers.map((o) => (
              <li key={o.id} className="border-l-2 border-terracotta pl-2.5 text-[0.85rem] text-forest">
                {pick(o.label, lang)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <div className="eyebrow">{t('freshness')}</div>
        <p className="mt-1 text-[0.85rem] text-charcoal/85">{t(FRESH[store.freshness])}</p>
      </div>

      <div className="mt-4">
        <TrustBadge status={store.verification} />
      </div>

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          disabled={!deliverable}
          aria-disabled={!deliverable}
          onClick={() => enterStore(store, lang, nav, view === 'immersive')}
          className="tap border border-forest bg-forest px-4 text-[0.9rem] font-medium text-cream hover:bg-charcoal disabled:cursor-not-allowed disabled:border-forest/25 disabled:bg-limestone disabled:text-forest/55"
        >
          {t('enterStore')}
        </button>
        {!deliverable && <p className="text-[0.72rem] text-charcoal/70">{t('cannotEnter')}</p>}
        <button type="button" onClick={() => select(null)} className="tap border border-forest/40 px-4 text-[0.9rem] font-medium text-forest hover:bg-forest/10">
          {t('backToDiscovery')}
        </button>
      </div>
    </section>
  )
}
