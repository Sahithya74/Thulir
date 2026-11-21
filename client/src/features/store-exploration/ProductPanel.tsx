import { useNavigate } from 'react-router-dom'
import { DEPARTMENT_LABEL, formatPaise, type SearchHit } from '@thulir/shared'
import { FreshnessChip, Price, VegMark } from '@/components/products/ProductCard'
import { AddToBasket } from '@/components/cart/AddToBasket'
import { ProductImage } from '@/components/products/ProductImage'
import { describeFreshness } from '@/components/products/freshness'
import { pick, useLang, useT } from '@/services/i18n'
import { catalogApi } from '@/services/catalogApi'
import { useAsync } from '@/hooks/useAsync'

interface Props {
  productId: string
  /** Called when the panel wants a product in the current store to become selected. */
  onSelectLocal: (id: string) => void
  currentStoreId: string
  onClose: () => void
}

function SubstituteRow({ hit, onPick }: { hit: SearchHit; onPick: () => void }) {
  const lang = useLang()
  const p = hit.product
  return (
    <li>
      <button type="button" onClick={onPick} className="flex w-full items-center gap-3 border-b border-line py-2 text-left hover:bg-limestone/60">
        <ProductImage product={p} className="h-12 w-12 shrink-0 bg-cream" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.88rem] text-forest">{pick(p.name, lang)}</span>
          <span className="block truncate text-[0.72rem] text-charcoal/65">
            {p.brand} · {p.unit} · {pick(hit.store.name, lang)}
          </span>
        </span>
        <span className="font-display text-[0.95rem]">{formatPaise(p.pricePaise)}</span>
      </button>
    </li>
  )
}

/** Product details. Every figure shown here came from the server's customer-safe view of the product. */
export function ProductPanel({ productId, onSelectLocal, currentStoreId, onClose }: Props) {
  const t = useT()
  const lang = useLang()
  const nav = useNavigate()
  const { state, retry } = useAsync((signal) => catalogApi.product(productId, signal), [productId])

  return (
    <section data-product-panel aria-label={t('productInfo')} className="flex h-full min-h-0 flex-col border border-line bg-cream shadow-[0_24px_60px_-28px_rgba(43, 26, 18,0.5)]">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
        <span className="eyebrow">{t('productInfo')}</span>
        <button type="button" onClick={onClose} aria-label={t('closeDetails')} className="tap -mr-2 px-2 text-xl text-forest/70 hover:text-forest">
          ×
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5">
        {state.status === 'loading' && <p role="status" className="py-10 text-center text-[0.85rem] text-charcoal/65">{t('loadingProducts')}…</p>}

        {state.status === 'error' && (
          <div role="alert" className="py-8 text-center">
            <p className="text-[0.9rem]">{state.code === 'PRODUCT_NOT_AVAILABLE' ? 'This product is not available right now.' : t('catalogError')}</p>
            {state.code !== 'PRODUCT_NOT_AVAILABLE' && (
              <button type="button" onClick={retry} className="tap mt-3 border border-forest px-4 text-[0.85rem]">
                {t('retry')}
              </button>
            )}
          </div>
        )}

        {state.status === 'ready' && (() => {
          const { hit, substitutes } = state.data
          const p = hit.product
          const f = describeFreshness(p.eligibility, lang, t)
          const sold = !p.eligibility.sellable
          return (
            <>
              <div className="relative mt-4 grid aspect-[5/3] place-items-center bg-white">
                <ProductImage product={p} labelled className="h-[82%] w-auto max-w-[90%]" />
                {p.discountPercent > 0 && !sold && <span className="absolute left-0 top-3 bg-terracotta px-2.5 py-1 text-[0.75rem] font-semibold text-white">{t('savePct', { pct: p.discountPercent })}</span>}
              </div>

              <div className="mt-4 flex items-center gap-2 text-[0.78rem] text-charcoal/70">
                <VegMark veg={p.veg} />
                <span>{p.brand}</span>
                <span aria-hidden>·</span>
                <span>{p.unit}</span>
              </div>
              <h2 className="mt-1 font-display text-[1.6rem] leading-tight text-forest">{pick(p.name, lang)}</h2>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <Price product={p} large />
                {p.discountPercent > 0 && <span className="text-[0.75rem] text-charcoal/60">{t('mrp')}</span>}
              </div>

              <div className="mt-3 border-l-2 border-line pl-3">
                <FreshnessChip product={p} />
                {f.detail && <p className="mt-0.5 text-[0.82rem] text-charcoal/80">{f.detail}</p>}
                {!f.detail && p.eligibility.status !== 'out_of_stock' && <p className="mt-0.5 text-[0.82rem] text-charcoal/65">{t('noExpiry')}</p>}
                {p.eligibility.sellable && <p className="mt-0.5 text-[0.78rem] text-charcoal/65">{t('availableQty', { n: p.eligibility.sellableQty })}</p>}
              </div>

              <div className="mt-4">
                <AddToBasket product={p} size="lg" />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-[0.82rem]">
                <div>
                  <dt className="eyebrow">{t('soldBy')}</dt>
                  <dd className="mt-0.5">{pick(hit.store.name, lang)}</dd>
                </div>
                <div>
                  <dt className="eyebrow">{t('department')}</dt>
                  <dd className="mt-0.5">{pick(DEPARTMENT_LABEL[p.department], lang)}</dd>
                </div>
                <div>
                  <dt className="eyebrow">{t('packSize')}</dt>
                  <dd className="mt-0.5">{p.unit}</dd>
                </div>
                <div>
                  <dt className="eyebrow">{t('brandLabel')}</dt>
                  <dd className="mt-0.5">{p.brand}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[0.85rem] leading-relaxed text-charcoal/85">{p.description}</p>

              <details className="mt-4 border border-line bg-white/60 text-[0.82rem]">
                <summary className="tap flex cursor-pointer items-center px-3 font-medium text-forest">{t('howFresh')}</summary>
                <p className="border-t border-line px-3 py-2.5 leading-relaxed text-charcoal/80">{t('howFreshBody')}</p>
              </details>

              <div className="mt-5">
                <h3 className="eyebrow">{t('substitutes')}</h3>
                {substitutes.length === 0 ? (
                  <p className="mt-2 text-[0.82rem] text-charcoal/65">{t('noSubs')}</p>
                ) : (
                  <ul className="mt-1">
                    {substitutes.map((s) => (
                      <SubstituteRow
                        key={s.product.id}
                        hit={s}
                        onPick={() => {
                          if (s.store.id === currentStoreId) onSelectLocal(s.product.id)
                          else nav(`/store/${s.store.slug}?product=${s.product.id}`)
                        }}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )
        })()}
      </div>
    </section>
  )
}
