import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatPaise, isOpenAt } from '@thulir/shared'
import { TopBar } from '@/components/navigation/TopBar'
import { TrustBadge } from '@/components/trust/TrustBadge'
import { StoreShop } from '@/features/store-exploration/StoreShop'
import { useAsync } from '@/hooks/useAsync'
import { catalogApi } from '@/services/catalogApi'
import { categoryKey, pick, useLang, useT } from '@/services/i18n'
import { useLocation } from '@/store/location'
import { useStores } from '@/store/stores'
import { useTransition } from '@/store/transition'

export default function StorePage() {
  const t = useT()
  const lang = useLang()
  const { slug } = useParams()
  const store = useStores((s) => s.stores.find((x) => x.slug === slug))
  const location = useLocation((s) => s.location)
  const { state, retry } = useAsync((signal) => catalogApi.storeCatalog(store!.id, signal), [store?.id], Boolean(store))

  // Hand over from the store-entry wipe once this page is on screen.
  useEffect(() => {
    const { phase, setPhase } = useTransition.getState()
    if (phase === 'covered') {
      const id = window.setTimeout(() => setPhase('revealing'), 120)
      return () => window.clearTimeout(id)
    }
  }, [])

  if (!store) {
    return (
      <div className="min-h-dvh bg-cream">
        <TopBar />
        <main className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="font-display text-2xl text-forest">{t('storeNotFound')}</h1>
          <Link to="/discover" className="tap mt-6 inline-flex items-center border border-forest bg-forest px-5 text-cream">
            {t('backToStores')}
          </Link>
        </main>
      </div>
    )
  }

  const open = isOpenAt(store.hours)
  const { deliverable, etaMin, distanceM } = store.delivery

  return (
    <div className="min-h-dvh bg-cream">
      <TopBar />
      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-4 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-line pb-4">
          <div>
            <Link to="/discover" className="tap -ml-1 inline-flex items-center px-1 text-[0.82rem] text-forest underline underline-offset-4">
              ← {t('backToStores')}
            </Link>
            <p className="eyebrow mt-1">{t(categoryKey[store.category])}</p>
            <h1 className="font-display text-[clamp(1.9rem,4.5vw,3rem)] leading-[1.05] text-forest">{pick(store.name, lang)}</h1>
            <p className="mt-1 text-[0.95rem] text-charcoal/75">{pick(store.tagline, lang)}</p>
            <div className="mt-2 max-w-xs">
              <TrustBadge status={store.verification} />
            </div>
          </div>
          <dl className="flex flex-wrap gap-x-7 gap-y-2 text-[0.82rem]">
            <div>
              <dt className="eyebrow">{t('hours')}</dt>
              <dd className="mt-0.5 flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${open ? 'bg-olive' : 'bg-terracotta'}`} />
                {open ? t('open') : t('closed')} · {store.hours.opens}–{store.hours.closes}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{t('delivery')}</dt>
              <dd className="mt-0.5">
                {deliverable ? `${etaMin} ${t('min')}` : '—'} · {(distanceM / 1000).toFixed(1)} km{location ? ` · ${pick(location.label, lang)}` : ''}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">{t('deliveryFee')}</dt>
              <dd className="mt-0.5">{formatPaise(store.deliveryFeePaise)} · {t('freeAbove', { amount: formatPaise(store.freeDeliveryAbovePaise) })}</dd>
            </div>
            <div>
              <dt className="eyebrow">{t('rating')}</dt>
              <dd className="mt-0.5">★ {store.rating.toFixed(1)} ({store.reviewCount})</dd>
            </div>
          </dl>
        </header>

        {!deliverable && (
          <p role="status" className="mt-3 border-l-2 border-terracotta bg-terracotta/10 px-3 py-2 text-[0.85rem]">
            {t('notDeliverable')} — {t('cannotEnter')}
          </p>
        )}

        <div className="mt-5">
          {state.status === 'loading' && (
            <div role="status" aria-label={t('loadingProducts')} className="grid gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="h-56 animate-pulse bg-limestone/70" />
              ))}
            </div>
          )}
          {state.status === 'error' && (
            <div role="alert" className="border border-dashed border-terracotta px-4 py-10 text-center">
              <p>{t('catalogError')}</p>
              <button type="button" onClick={retry} className="tap mt-3 border border-forest px-4 text-[0.85rem]">
                {t('retry')}
              </button>
            </div>
          )}
          {state.status === 'ready' && <StoreShop store={store} catalog={state.data} source={state.source} />}
        </div>
      </main>
    </div>
  )
}
