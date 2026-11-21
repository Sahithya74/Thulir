import { forwardRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { StoreWithDelivery } from '@thulir/shared'
import { categoryKey, pick, useLang, useT } from '@/services/i18n'
import { useDiscovery } from '@/store/discovery'
import { useStores } from '@/store/stores'
import { CATEGORIES, Chip, FLAGS } from './DiscoveryPanel'
import { ShopArc } from './ShopArc'

interface Props {
  stores: StoreWithDelivery[]
  tabs: React.ReactNode
}

/** The default way to choose a shop: filters on top, then the arc of shops you swipe or scroll through. */
export const ArcView = forwardRef<HTMLInputElement, Props>(function ArcView({ stores, tabs }, searchRef) {
  const t = useT()
  const lang = useLang()
  const d = useDiscovery(
    useShallow((s) => ({
      query: s.query,
      setQuery: s.setQuery,
      categories: s.categories,
      toggleCategory: s.toggleCategory,
      openNow: s.openNow,
      fast: s.fast,
      offers: s.offers,
      nearby: s.nearby,
      toggleFlag: s.toggleFlag,
      clearFilters: s.clearFilters,
    })),
  )
  const allStores = useStores((s) => s.stores)
  const offers = allStores.flatMap((st) => st.offers.map((o) => `${pick(st.name, lang)} — ${pick(o.label, lang)}`))
  const anyFilter = d.query || d.categories.length || d.openNow || d.fast || d.offers || d.nearby

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(70%_60%_at_50%_0%,#ffe7b0_0%,transparent_70%),radial-gradient(50%_50%_at_90%_80%,rgba(217,79,43,0.14)_0%,transparent_70%),radial-gradient(45%_45%_at_5%_90%,rgba(169,207,138,0.35)_0%,transparent_70%)]">
      {tabs}
      {offers.length > 0 && (
        <div className="shrink-0 overflow-hidden border-b border-forest/10 bg-forest py-1.5 text-cream" aria-label={t('offersLive')}>
          <div className="marquee flex w-max gap-10 whitespace-nowrap text-[0.78rem]" aria-hidden>
            {[...offers, ...offers].map((o, i) => (
              <span key={i} className="flex items-center gap-10">
                {o}
                <span className="inline-block h-1.5 w-1.5 rotate-45 bg-sun" />
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mx-auto w-full max-w-5xl shrink-0 px-4 pt-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="arc-search">
            {t('searchStores')}
          </label>
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-forest/20 bg-white/80 px-4 shadow-sm backdrop-blur focus-within:border-forest sm:w-72 sm:shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-forest/60">
              <circle cx="7" cy="7" r="4.7" stroke="currentColor" strokeWidth="1.4" />
              <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              id="arc-search"
              ref={searchRef}
              type="search"
              value={d.query}
              onChange={(e) => d.setQuery(e.target.value)}
              placeholder={t('searchStores')}
              autoComplete="off"
              className="tap w-full bg-transparent text-[0.9rem] text-forest outline-none placeholder:text-charcoal/50"
            />
          </div>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 sm:pb-0" role="group" aria-label={t('filters')}>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={d.categories.includes(c)} onClick={() => d.toggleCategory(c)}>
                {t(categoryKey[c])}
              </Chip>
            ))}
            {FLAGS.map((f) => (
              <Chip key={f.key} active={d[f.key]} onClick={() => d.toggleFlag(f.key)}>
                {t(f.label)}
              </Chip>
            ))}
            {anyFilter ? (
              <button type="button" onClick={d.clearFilters} className="tap shrink-0 px-2 text-[0.78rem] text-terracotta underline underline-offset-2">
                {t('clearFilters')}
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-[0.75rem] text-charcoal/65" aria-live="polite">
          {t(stores.length === 1 ? 'storeFound' : 'storesFound', { n: stores.length })} · {t('deliversCount', { n: allStores.filter((x) => x.delivery.deliverable).length, m: allStores.length })}
        </p>
      </div>
      <ShopArc stores={stores} />
    </div>
  )
})
