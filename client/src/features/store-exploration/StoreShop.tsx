import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEPARTMENT_LABEL, formatPaise, type Department, type StoreCatalog, type StoreWithDelivery } from '@thulir/shared'
import { FreshnessChip, Price, ProductCard } from '@/components/products/ProductCard'
import { useIsSmall, useQualityTier, useWebGLSupport } from '@/hooks/useDevice'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { STORE_THEMES } from '@/scenes/stores/themes'
import { padProducts, planStore } from '@/scenes/stores/walkLayout'
import { walkCmd } from '@/scenes/stores/walkBus'
import { pick, useLang, useT } from '@/services/i18n'
import type { DataSource } from '@/services/catalogApi'
import { DEFAULT_FILTER, PRICE_STEPS_PAISE, applyProductFilter, brandsOf, type ProductFilter, type SortKey } from './productFilter'
import { BentoGrid } from './BentoGrid'
import { ProductPanel } from './ProductPanel'
import { DPad, MiniMap } from './WalkOverlay'

// The walk-in store (three.js) is its own chunk; the list view never pays for it.
const StoreWalk = lazy(() => import('@/scenes/stores/StoreWalk'))

const SORTS: { key: SortKey; label: Parameters<ReturnType<typeof useT>>[0] }[] = [
  { key: 'relevance', label: 'sortRelevance' },
  { key: 'priceLow', label: 'sortPriceLow' },
  { key: 'priceHigh', label: 'sortPriceHigh' },
  { key: 'name', label: 'sortName' },
  { key: 'discount', label: 'sortDiscount' },
]

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[0.78rem] transition-colors lg:min-h-9 ${on ? 'border-forest bg-forest text-cream' : 'border-forest/25 bg-white/60 text-forest hover:border-forest/60'}`}
    >
      {children}
    </button>
  )
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-full border border-forest/25 bg-white/80 px-3 text-[0.78rem] lg:min-h-9">
      <span className="text-charcoal/60">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent py-1 text-forest outline-none">
        {children}
      </select>
    </label>
  )
}

interface Props {
  store: StoreWithDelivery
  catalog: StoreCatalog
  source: DataSource
}

export function StoreShop({ store, catalog, source }: Props) {
  const t = useT()
  const lang = useLang()
  const small = useIsSmall()
  const webgl = useWebGLSupport()
  const tier = useQualityTier()
  const reduced = useReducedMotion()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<ProductFilter>(DEFAULT_FILTER)
  const [view, setView] = useState<'shelf' | 'grid'>(() => (webgl && !small ? 'shelf' : 'grid'))
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const selectedId = params.get('product')
  const shelfMode = view === 'shelf' && webgl

  const set = <K extends keyof ProductFilter>(k: K, v: ProductFilter[K]) => setFilter((f) => ({ ...f, [k]: v }))
  const select = (id: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (id) n.set('product', id)
        else n.delete('product')
        return n
      },
      { replace: true },
    )

  const depts = catalog.departments
  // Walking in shows the whole store; filters and search then become a "matches" list to walk to.
  const effective = shelfMode ? { ...filter, department: 'all' as const } : filter

  const filtered = useMemo(
    () => applyProductFilter(catalog.products, effective),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog.products, filter, shelfMode],
  )
  const filtering = !!filter.query || filter.brand !== 'all' || filter.maxPricePaise != null || filter.onOffer || filter.vegOnly
  const brands = useMemo(() => brandsOf(catalog.products), [catalog.products])
  const walkProducts = useMemo(() => {
    const order = new Map(depts.map((d, i) => [d.id, i]))
    const sorted = [...catalog.products].sort((a, b) => (order.get(a.department) ?? 99) - (order.get(b.department) ?? 99))
    // A real shop repeats its lines across several runs; a small catalogue is spread over a believable floor.
    return padProducts(sorted, store.category === 'supermarket' ? 3 : sorted.length < 24 ? 2 : 1)
  }, [catalog.products, depts, store.category])
  const plan = useMemo(() => planStore(walkProducts), [walkProducts])
  const [nearDept, setNearDept] = useState<string | null>(null)

  // Esc closes the details panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && selectedId && select(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const theme = STORE_THEMES[store.category]
  const hovered = hoveredId ? catalog.products.find((p) => p.id === hoveredId) : null
  const deptName = nearDept ? pick(DEPARTMENT_LABEL[nearDept as Department], lang) : pick(store.name, lang)
  const checked = new Date(catalog.checkedAt).toLocaleTimeString(lang === 'ta' ? 'ta-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`grid gap-5 ${selectedId ? 'lg:grid-cols-[minmax(0,1fr)_370px]' : ''}`}>
      <div className="min-w-0">
        {/* departments */}
        <div role="tablist" aria-label={t('department')} className="flex gap-1.5 overflow-x-auto pb-1">
          {!shelfMode && (
            <button type="button" role="tab" aria-selected={filter.department === 'all'} onClick={() => set('department', 'all')} className={`tap shrink-0 whitespace-nowrap rounded-full px-4 text-[0.85rem] font-medium ${filter.department === 'all' ? 'bg-forest text-cream' : 'bg-white/60 text-charcoal/75 hover:bg-forest/10'}`}>
              {t('all')} <span className="opacity-60">{catalog.products.length}</span>
            </button>
          )}
          {depts.map((d) => {
            const active = shelfMode ? nearDept === d.id : filter.department === d.id
            return (
              <button key={d.id} type="button" role="tab" aria-selected={active} title={shelfMode ? t('walkToDept', { dept: pick(DEPARTMENT_LABEL[d.id], lang) }) : undefined} onClick={() => (shelfMode ? walkCmd.emit({ type: 'dept', dept: d.id }) : set('department', d.id))} className={`tap shrink-0 whitespace-nowrap rounded-full px-4 text-[0.85rem] font-medium uppercase tracking-wide ${active ? 'bg-forest text-cream' : 'bg-white/60 text-charcoal/75 hover:bg-forest/10'}`}>
                {pick(DEPARTMENT_LABEL[d.id], lang)} <span className="opacity-60">{d.count}</span>
              </button>
            )
          })}
        </div>

        {/* toolbar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="store-product-search">{t('searchInStore')}</label>
          <div className="flex min-h-10 min-w-[12rem] flex-1 items-center gap-2 rounded-full border border-forest/30 bg-white/80 px-4 focus-within:border-forest lg:min-h-9">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-forest/60">
              <circle cx="7" cy="7" r="4.7" stroke="currentColor" strokeWidth="1.4" />
              <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input id="store-product-search" type="search" value={filter.query} onChange={(e) => set('query', e.target.value)} placeholder={t('searchInStore')} autoComplete="off" className="w-full bg-transparent text-[0.88rem] outline-none placeholder:text-charcoal/45" />
          </div>
          <Select label={t('sortBy')} value={filter.sort} onChange={(v) => set('sort', v as SortKey)}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{t(s.label)}</option>)}
          </Select>
          <Select label={t('brandLabel')} value={filter.brand} onChange={(v) => set('brand', v)}>
            <option value="all">{t('allBrands')}</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
          <Select label={t('maxPrice')} value={String(filter.maxPricePaise ?? '')} onChange={(v) => set('maxPricePaise', v ? Number(v) : null)}>
            <option value="">{t('anyPrice')}</option>
            {PRICE_STEPS_PAISE.map((p) => <option key={p} value={p}>≤ {formatPaise(p)}</option>)}
          </Select>
          <Toggle on={filter.onOffer} onClick={() => set('onOffer', !filter.onOffer)}>{t('onOffer')}</Toggle>
          <Toggle on={filter.vegOnly} onClick={() => set('vegOnly', !filter.vegOnly)}>{t('vegOnly')}</Toggle>
          <div role="group" aria-label="View" className="ml-auto flex">
            <button type="button" aria-pressed={shelfMode} disabled={!webgl} onClick={() => setView('shelf')} className={`min-h-10 rounded-l-full border px-4 text-[0.78rem] disabled:opacity-40 lg:min-h-9 ${shelfMode ? 'border-forest bg-forest text-cream' : 'border-forest/25 text-forest'}`}>{t('viewWalk')}</button>
            <button type="button" aria-pressed={!shelfMode} onClick={() => setView('grid')} className={`min-h-10 rounded-r-full border border-l-0 px-4 text-[0.78rem] lg:min-h-9 ${!shelfMode ? 'border-forest bg-forest text-cream' : 'border-forest/25 text-forest'}`}>{t('viewGrid')}</button>
          </div>
        </div>

        <p className="mt-2 text-[0.75rem] text-charcoal/65" aria-live="polite">
          {t('resultsCount', { n: filtered.length })}
        </p>

        {/* stage */}
        {shelfMode ? (
          <>
            <div className="relative mt-2 h-[68dvh] min-h-[400px] max-h-[760px] overflow-hidden rounded-[1.75rem] border border-line shadow-[0_18px_50px_-24px_rgba(43,26,18,0.55)]" style={{ background: theme.sky }}>
              <Suspense fallback={<div role="status" className="grid h-full place-items-center text-[0.8rem] text-charcoal/65">{t('loading')}…</div>}>
                <StoreWalk
                  plan={plan}
                  theme={theme}
                  storeName={store.name}
                  selectedId={selectedId}
                  hoveredId={hoveredId}
                  reducedMotion={reduced}
                  tier={tier}
                  label={t('shelfLabel')}
                  onHover={setHoveredId}
                  onSelect={(id) => select(id)}
                  onNearDept={setNearDept}
                />
              </Suspense>
              <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-forest/85 px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.12em] text-cream backdrop-blur">
                <span className="opacity-70">{t('walkYouAreIn')} · </span>{deptName}
              </p>
              <button type="button" onClick={() => walkCmd.emit({ type: 'entrance' })} className="absolute right-3 top-3 rounded-md bg-white/90 px-3 py-1.5 text-[0.72rem] font-medium text-forest shadow backdrop-blur hover:bg-white">
                {t('walkEntrance')}
              </button>
              {hovered && (
                <div className="pointer-events-none absolute bottom-16 left-3 max-w-[16rem] rounded-md border border-line bg-cream px-3 py-2 shadow-[0_10px_30px_-12px_rgba(43,26,18,0.45)] sm:bottom-3 sm:left-auto sm:right-[12.5rem]">
                  <p className="font-display text-[1rem] leading-tight text-forest">{pick(hovered.name, lang)}</p>
                  <p className="text-[0.72rem] text-charcoal/65">{hovered.brand} · {hovered.unit}</p>
                  <div className="mt-1 flex items-center justify-between gap-3"><Price product={hovered} /><FreshnessChip product={hovered} /></div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 sm:hidden">
                <DPad labels={{ forward: t('walkForward'), back: t('walkBack'), left: t('walkLeft'), right: t('walkRight') }} />
              </div>
              <div className="absolute bottom-3 right-3">
                <MiniMap plan={plan} accent={theme.accent} label={t('walkMap')} />
              </div>
              <p className="pointer-events-none absolute bottom-3 left-3 hidden max-w-[22rem] rounded-md bg-white/80 px-2.5 py-1 text-[0.7rem] text-forest/80 backdrop-blur sm:block">{t('shelfHint')}</p>
            </div>
            {filtering && (
              <div className="mt-4">
                <p className="text-[0.8rem] font-medium text-forest">{t('walkFound')}</p>
                {filtered.length === 0 ? (
                  <p className="mt-2 text-[0.85rem] text-charcoal/70">{t('noProducts')}</p>
                ) : (
                  <ul className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                    {filtered.map((p) => (
                      <li key={p.id}>
                        <ProductCard product={p} selected={selectedId === p.id} hovered={hoveredId === p.id} onSelect={(id) => select(id)} onHover={setHoveredId} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        ) : filtered.length === 0 ? (
          <p className="mt-6 border border-dashed border-forest/25 px-4 py-10 text-center text-[0.9rem] text-charcoal/70">{t('noProducts')}</p>
        ) : (
          <BentoGrid
            products={filtered}
            departments={depts}
            sectioned={filter.department === 'all' && !filtering}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={(id) => select(id)}
            onHover={setHoveredId}
          />
        )}

        <div className="mt-5 border-t border-line pt-3 text-[0.75rem] leading-relaxed text-charcoal/65">
          {catalog.hiddenCount > 0 && <p>{t('hiddenNote', { n: catalog.hiddenCount })}</p>}
          <p>{t('checkedAt', { time: checked })} · {source === 'api' ? t('apiLive') : t('apiOffline')}</p>
        </div>
      </div>

      {/* details: a column on desktop, a bottom sheet on small screens */}
      {selectedId && (
        <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[82dvh] lg:sticky lg:top-4 lg:z-auto lg:max-h-[calc(100dvh-2rem)] lg:self-start">
          <ProductPanel productId={selectedId} currentStoreId={store.id} onSelectLocal={(id) => select(id)} onClose={() => select(null)} />
        </aside>
      )}
    </div>
  )
}
