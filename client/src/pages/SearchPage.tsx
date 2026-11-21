import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { TopBar } from '@/components/navigation/TopBar'
import { ProductRow } from '@/components/products/ProductRow'
import { useAsync } from '@/hooks/useAsync'
import { catalogApi } from '@/services/catalogApi'
import { addRecent, clearRecent, readRecent } from '@/services/recentSearches'
import { useT } from '@/services/i18n'
import { useStores } from '@/store/stores'
import type { Suggestion } from '@thulir/shared'

/** Debounce a fast-changing value so we search when the customer pauses, not on every keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return v
}

export default function SearchPage() {
  const t = useT()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const urlQuery = params.get('q') ?? ''
  const [text, setText] = useState(urlQuery)
  const [recent, setRecent] = useState<string[]>(() => readRecent())
  const stores = useStores((s) => s.stores)
  const inputRef = useRef<HTMLInputElement>(null)

  const debounced = useDebounced(text.trim(), 220)
  const committed = urlQuery.trim()

  useEffect(() => inputRef.current?.focus(), [])

  const popular = useAsync((s) => catalogApi.popular(s), [])
  const suggest = useAsync((s) => catalogApi.suggest(debounced, s), [debounced], debounced.length >= 1 && debounced !== committed)
  const results = useAsync((s) => catalogApi.search(committed, { limit: 60 }, s), [committed], committed.length >= 1)

  const run = (q: string) => {
    const v = q.trim()
    setText(v)
    if (!v) return
    setRecent(addRecent(v))
    setParams({ q: v })
  }

  const pickSuggestion = (s: Suggestion) => {
    if (s.kind === 'product') {
      setRecent(addRecent(s.text.split(' · ')[0]))
      nav(`/store/${s.storeSlug}?product=${s.productId}`)
    } else run(s.text)
  }

  const showSuggest = text.trim().length >= 1 && text.trim() !== committed && suggest.state.status === 'ready'
  const storeInfo = (id: string) => stores.find((x) => x.id === id)

  return (
    <div className="min-h-dvh bg-cream">
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6">
        <h1 className="font-display text-[clamp(1.7rem,4vw,2.4rem)] leading-tight text-forest">{t('searchProducts')}</h1>
        <p className="mt-1 text-[0.85rem] text-charcoal/70">{t('searchHint')}</p>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            run(text)
          }}
          className="relative mt-4"
        >
          <label htmlFor="product-search" className="sr-only">{t('searchProducts')}</label>
          <div className="flex min-h-12 items-center gap-2 border border-forest/40 bg-white px-3 focus-within:border-forest">
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-forest/60">
              <circle cx="7" cy="7" r="4.7" stroke="currentColor" strokeWidth="1.4" />
              <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              id="product-search"
              ref={inputRef}
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              maxLength={80}
              placeholder={t('searchProducts')}
              className="w-full bg-transparent py-3 text-[1rem] outline-none placeholder:text-charcoal/45"
            />
          </div>

          {showSuggest && suggest.state.status === 'ready' && suggest.state.data.length > 0 && (
            <ul aria-label={t('suggestionsLabel')} className="absolute inset-x-0 top-full z-20 border border-t-0 border-forest/30 bg-white shadow-[0_18px_36px_-20px_rgba(15,42,67,0.5)]">
              {suggest.state.data.map((s, i) => (
                <li key={`${s.kind}-${s.text}-${i}`}>
                  <button type="button" onClick={() => pickSuggestion(s)} className="tap flex w-full items-center gap-3 px-3 text-left text-[0.9rem] hover:bg-limestone">
                    <span className="eyebrow w-16 shrink-0 !text-[0.6rem]">{s.kind === 'product' ? t('products') : s.kind === 'brand' ? t('brandLabel') : t('department')}</span>
                    <span className="truncate">{s.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>

        {/* idle: recent + popular */}
        {!committed && (
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {recent.length > 0 && (
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="eyebrow">{t('recentSearches')}</h2>
                  <button type="button" onClick={() => setRecent(clearRecent())} className="tap px-2 text-[0.75rem] text-terracotta underline underline-offset-2">{t('clearRecent')}</button>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {recent.map((r) => (
                    <li key={r}><button type="button" onClick={() => run(r)} className="tap border border-forest/25 px-3 text-[0.82rem] hover:border-forest">{r}</button></li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h2 className="eyebrow">{t('popularSearches')}</h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {popular.state.status === 'ready' &&
                  popular.state.data.map((r) => (
                    <li key={r}><button type="button" onClick={() => run(r)} className="tap border border-forest/25 px-3 text-[0.82rem] hover:border-forest">{r}</button></li>
                  ))}
              </ul>
            </section>
          </div>
        )}

        {/* results */}
        {committed && (
          <section className="mt-5" aria-live="polite">
            {results.state.status === 'loading' && <p role="status" className="py-8 text-center text-[0.85rem] text-charcoal/65">{t('loadingProducts')}…</p>}
            {results.state.status === 'error' && (
              <div role="alert" className="py-8 text-center">
                <p>{t('catalogError')}</p>
                <button type="button" onClick={results.retry} className="tap mt-3 border border-forest px-4 text-[0.85rem]">{t('retry')}</button>
              </div>
            )}
            {results.state.status === 'ready' && (
              <>
                <p className="text-[0.78rem] text-charcoal/65">{t('resultsCount', { n: results.state.data.length })} · “{committed}”</p>
                {results.state.data.length === 0 ? (
                  <p className="mt-6 border border-dashed border-forest/25 px-4 py-10 text-center text-[0.9rem] text-charcoal/70">{t('noProducts')}</p>
                ) : (
                  <ul className="mt-1">
                    {results.state.data.map((h) => {
                      const s = storeInfo(h.store.id)
                      return (
                        <ProductRow
                          key={h.product.id}
                          product={h.product}
                          store={h.store}
                          deliverable={s?.delivery.deliverable ?? true}
                          meta={s?.delivery.deliverable ? `${s.delivery.etaMin} ${t('min')}` : undefined}
                        />
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </section>
        )}

        <p className="mt-10 text-[0.82rem]">
          <Link to="/discover" className="text-forest underline underline-offset-4">← {t('backToStores')}</Link>
        </p>
      </main>
    </div>
  )
}
