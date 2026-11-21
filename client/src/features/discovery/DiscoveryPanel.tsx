import { forwardRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { isOpenAt, formatPaise, type StoreCategory, type StoreWithDelivery } from '@thulir/shared'
import { categoryKey, pick, useLang, useT, type DictKey } from '@/services/i18n'
import { useDiscovery } from '@/store/discovery'
import { useStores } from '@/store/stores'

export const CATEGORIES: StoreCategory[] = ['supermarket', 'provision', 'fruit_veg', 'bakery', 'dairy', 'household']
export const FLAGS: { key: 'openNow' | 'fast' | 'offers' | 'nearby'; label: DictKey }[] = [
  { key: 'openNow', label: 'openNow' },
  { key: 'fast', label: 'fastDelivery' },
  { key: 'nearby', label: 'nearby' },
  { key: 'offers', label: 'offers' },
]

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[0.78rem] lg:min-h-8 transition-colors ${
        active ? 'border-forest bg-forest text-cream' : 'border-forest/25 bg-white/60 text-forest hover:border-forest/60'
      }`}
    >
      {children}
    </button>
  )
}

function StoreRow({ store, wide }: { store: StoreWithDelivery; wide: boolean }) {
  const t = useT()
  const lang = useLang()
  const selectedId = useDiscovery((s) => s.selectedId)
  const hoveredId = useDiscovery((s) => s.hoveredId)
  const select = useDiscovery((s) => s.select)
  const hover = useDiscovery((s) => s.hover)
  const open = isOpenAt(store.hours)
  const active = selectedId === store.id
  return (
    <li>
      <button
        type="button"
        onClick={() => select(store.id)}
        onMouseEnter={() => hover(store.id)}
        onMouseLeave={() => hover(null)}
        onFocus={() => hover(store.id)}
        onBlur={() => hover(null)}
        aria-pressed={active}
        className={`group grid w-full ${store.delivery.deliverable ? '' : 'opacity-70'} gap-x-4 border-b border-line px-4 py-3.5 text-left transition-colors ${
          wide ? 'grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_1fr_auto]' : 'grid-cols-[1fr_auto]'
        } ${active ? 'bg-forest text-cream' : hoveredId === store.id ? 'bg-limestone' : 'hover:bg-limestone'}`}
      >
        <span className="min-w-0">
          <span className={`eyebrow block ${active ? '!text-botanical' : ''}`}>{t(categoryKey[store.category])}</span>
          <span className="mt-0.5 block truncate font-display text-[1.1rem] leading-snug">{pick(store.name, lang)}</span>
          <span className={`mt-0.5 block text-[0.78rem] ${active ? 'text-cream/75' : 'text-charcoal/70'}`}>
            {pick(store.tagline, lang)}
          </span>
        </span>
        {wide && (
          <span className={`hidden self-center text-[0.8rem] sm:block ${active ? 'text-cream/80' : 'text-charcoal/75'}`}>
            {store.offers[0] ? pick(store.offers[0].label, lang) : <span className="opacity-60">—</span>}
            <span className="mt-0.5 block text-[0.72rem] opacity-75">
              {t('deliveryFee')} {formatPaise(store.deliveryFeePaise)}
            </span>
          </span>
        )}
        <span className="self-center text-right text-[0.78rem] leading-snug">
          <span className="flex items-center justify-end gap-1.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${open ? 'bg-olive' : 'bg-terracotta'}`} />
            {open ? t('open') : t('closed')}
          </span>
          <span className={`block ${active ? 'text-cream/80' : 'text-charcoal/70'}`}>
            {store.delivery.etaMin} {t('min')} · {(store.delivery.distanceM / 1000).toFixed(1)} km
          </span>
          <span className={`block ${active ? 'text-cream/80' : 'text-charcoal/70'}`}>★ {store.rating.toFixed(1)}</span>
        </span>
      </button>
    </li>
  )
}

interface Props {
  stores: StoreWithDelivery[]
  wide?: boolean
}

export const DiscoveryPanel = forwardRef<HTMLInputElement, Props>(function DiscoveryPanel({ stores, wide = false }, searchRef) {
  const t = useT()
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
  const source = useStores((s) => s.source)
  const deliverN = allStores.filter((x) => x.delivery.deliverable).length
  const anyFilter = d.query || d.categories.length || d.openNow || d.fast || d.offers || d.nearby

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-line px-4 pb-3 pt-4">
        <label className="sr-only" htmlFor="store-search">
          {t('searchStores')}
        </label>
        <div className="flex items-center gap-2 border border-forest/30 bg-white px-3 focus-within:border-forest">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-forest/60">
            <circle cx="7" cy="7" r="4.7" stroke="currentColor" strokeWidth="1.4" />
            <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            id="store-search"
            ref={searchRef}
            type="search"
            value={d.query}
            onChange={(e) => d.setQuery(e.target.value)}
            placeholder={t('searchStores')}
            autoComplete="off"
            className="tap w-full bg-transparent text-[0.9rem] text-forest outline-none placeholder:text-charcoal/50"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t('filters')}>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={d.categories.includes(c)} onClick={() => d.toggleCategory(c)}>
              {t(categoryKey[c])}
            </Chip>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FLAGS.map((f) => (
            <Chip key={f.key} active={d[f.key]} onClick={() => d.toggleFlag(f.key)}>
              {t(f.label)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between px-4 py-2 text-[0.75rem] text-charcoal/70" aria-live="polite">
        <span>
          {t(stores.length === 1 ? 'storeFound' : 'storesFound', { n: stores.length })} · {t('deliversCount', { n: deliverN, m: allStores.length })}
        </span>
        {anyFilter ? (
          <button type="button" onClick={d.clearFilters} className="tap px-2 text-terracotta underline underline-offset-2">
            {t('clearFilters')}
          </button>
        ) : null}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {stores.map((s) => (
          <StoreRow key={s.id} store={s} wide={wide} />
        ))}
        {deliverN === 0 && <li className="border-b border-line bg-terracotta/10 px-4 py-3 text-[0.85rem]">{t('noneDeliver')}</li>}
        {stores.length === 0 && <li className="px-4 py-10 text-center text-[0.9rem] text-charcoal/70">{t('noStores')}</li>}
      </ul>

      <p className="shrink-0 border-t border-line px-4 py-2 text-[0.6875rem] leading-snug text-charcoal/60">{t('simulatedNote')} {source === 'api' ? t('apiLive') : t('apiOffline')}</p>
    </div>
  )
})
