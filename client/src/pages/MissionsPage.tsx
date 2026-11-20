import { Link, useSearchParams } from 'react-router-dom'
import { formatPaise, type MissionResult } from '@thulir/shared'
import { TopBar } from '@/components/navigation/TopBar'
import { ProductRow } from '@/components/products/ProductRow'
import { useAsync } from '@/hooks/useAsync'
import { catalogApi } from '@/services/catalogApi'
import { pick, useLang, useT } from '@/services/i18n'
import { useLocation } from '@/store/location'

const TAG_LABEL: Record<string, string> = {
  rice: 'Rice',
  toordal: 'Toor dal',
  sambarpowder: 'Sambar powder',
  rasampowder: 'Rasam powder',
  tomato: 'Tomato',
  onion: 'Onion',
  drumstick: 'Drumstick',
  curryleaf: 'Curry leaves',
  lemon: 'Lemon',
  oil: 'Cooking oil',
  greenchilli: 'Green chilli',
  atta: 'Wheat flour',
  potato: 'Potato',
  garlic: 'Garlic',
  tamarind: 'Tamarind',
  idlibatter: 'Idli batter',
  coconut: 'Coconut',
}

function Meals({ result }: { result: MissionResult }) {
  const t = useT()
  const lang = useLang()
  return (
    <div className="mt-5">
      <h2 className="eyebrow">{t('mealsHeading')}</h2>
      <ul className="mt-2 grid gap-3">
        {result.meals.map(({ meal, items }) => {
          const total = items.reduce((n, i) => n + (i.product?.pricePaise ?? 0), 0)
          const missing = items.filter((i) => !i.product).length
          return (
            <li key={meal.id}>
              <details className="border border-line bg-white">
                <summary className="tap flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 px-4 py-3">
                  <span className="font-display text-[1.15rem] text-forest">{pick(meal.name, lang)}</span>
                  <span className="text-[0.78rem] text-charcoal/65">
                    {items.length} {t('ingredients').toLowerCase()}
                    {missing > 0 ? ` · ${missing} ${t('notNearby').toLowerCase()}` : ''}
                  </span>
                </summary>
                <div className="border-t border-line px-4 pb-3">
                  <p className="pt-2 text-[0.85rem] text-charcoal/75">{pick(meal.blurb, lang)}</p>
                  <ul className="mt-1">
                    {items.map((i) =>
                      i.product && i.storeSlug ? (
                        <li key={i.tag} className="flex items-center justify-between gap-3 border-b border-line py-2 text-[0.88rem] last:border-b-0">
                          <span className="min-w-0">
                            <span className="block text-charcoal/60">{TAG_LABEL[i.tag] ?? i.tag}</span>
                            <Link to={`/store/${i.storeSlug}?product=${i.product.id}`} className="block truncate text-forest underline underline-offset-2">
                              {pick(i.product.name, lang)} · {i.product.unit}
                            </Link>
                          </span>
                          <span className="font-display">{formatPaise(i.product.pricePaise)}</span>
                        </li>
                      ) : (
                        <li key={i.tag} className="flex items-center justify-between gap-3 border-b border-line py-2 text-[0.88rem] text-charcoal/60 last:border-b-0">
                          <span>{TAG_LABEL[i.tag] ?? i.tag}</span>
                          <span>{t('notNearby')}</span>
                        </li>
                      ),
                    )}
                  </ul>
                  <p className="pt-2 text-right text-[0.85rem]">{t('approxTotal', { amount: formatPaise(total) })}</p>
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function MissionsPage() {
  const t = useT()
  const lang = useLang()
  const [params, setParams] = useSearchParams()
  const active = params.get('m')
  const location = useLocation((s) => s.location)
  const openPicker = useLocation((s) => s.openPicker)
  const list = useAsync((s) => catalogApi.missions(s), [])
  const geo = location?.geo
  const result = useAsync((s) => catalogApi.mission(active!, geo!, s), [active, geo?.lat, geo?.lng], Boolean(active && geo))

  return (
    <div className="min-h-dvh bg-cream">
      <TopBar />
      <main className="mx-auto max-w-4xl px-4 pb-20 pt-6 sm:px-6">
        <p className="eyebrow">{t('missionsOptional')}</p>
        <h1 className="mt-1 font-display text-[clamp(1.9rem,5vw,3rem)] leading-[1.05] text-forest">{t('missionsTitle')}</h1>
        <p className="mt-2 max-w-xl text-[0.95rem] text-charcoal/75">{t('missionsIntro')}</p>

        {!location && (
          <div role="status" className="mt-5 flex flex-wrap items-center gap-3 border-l-2 border-terracotta bg-terracotta/10 px-3 py-2.5 text-[0.88rem]">
            <span>{t('needLocation')}</span>
            <button type="button" onClick={openPicker} className="tap border border-forest bg-forest px-4 text-[0.85rem] text-cream">{t('chooseLocation')}</button>
          </div>
        )}

        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {list.state.status === 'ready' &&
            list.state.data.map((m) => {
              const on = active === m.id
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setParams(on ? {} : { m: m.id })}
                    className={`flex h-full w-full flex-col items-start border px-4 py-3.5 text-left transition-colors ${on ? 'border-forest bg-forest text-cream' : 'border-line bg-white hover:border-forest/50'}`}
                  >
                    <span className="font-display text-[1.2rem] leading-snug">{pick(m.title, lang)}</span>
                    <span className={`mt-1 text-[0.82rem] ${on ? 'text-cream/80' : 'text-charcoal/70'}`}>{pick(m.blurb, lang) || m.blurb.en}</span>
                  </button>
                </li>
              )
            })}
        </ul>

        {active && geo && (
          <section className="mt-8 border-t border-line pt-5" aria-live="polite">
            {result.state.status === 'loading' && <p role="status" className="text-[0.85rem] text-charcoal/65">{t('loadingProducts')}…</p>}
            {result.state.status === 'error' && (
              <div role="alert">
                <p>{t('catalogError')}</p>
                <button type="button" onClick={result.retry} className="tap mt-3 border border-forest px-4 text-[0.85rem]">{t('retry')}</button>
              </div>
            )}
            {result.state.status === 'ready' && (() => {
              const r = result.state.data
              const empty = r.groups.length === 0 && r.meals.length === 0
              return (
                <>
                  <h2 className="font-display text-[1.5rem] text-forest">{pick(r.mission.title, lang)}</h2>
                  {empty && <p className="mt-3 border border-dashed border-forest/25 px-4 py-8 text-center text-[0.9rem] text-charcoal/70">{t('noMissionItems')}</p>}
                  {r.meals.length > 0 && <Meals result={r} />}
                  {r.groups.map((g) => (
                    <div key={g.store.id} className="mt-6">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-display text-[1.2rem] text-forest">{pick(g.store.name, lang)}</h3>
                        <Link to={`/store/${g.store.slug}`} className="text-[0.8rem] text-forest underline underline-offset-4">{t('viewInStore')}</Link>
                      </div>
                      <p className="text-[0.78rem] text-charcoal/65">{g.store.etaMin} {t('min')} · {(g.store.distanceM / 1000).toFixed(1)} km</p>
                      <ul className="mt-1">
                        {g.products.map((p) => (
                          <ProductRow key={p.id} product={p} store={g.store} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              )
            })()}
          </section>
        )}

        <p className="mt-10 text-[0.82rem]">
          <Link to="/discover" className="text-forest underline underline-offset-4">← {t('backToStores')}</Link>
        </p>
      </main>
    </div>
  )
}
