import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { MAX_LINE_QTY, formatPaise, type CartLineView, type CartStoreGroup } from '@thulir/shared'
import { ProductImage } from '@/components/products/ProductImage'
import { dur, ease } from '@/services/motion'
import { pick, useLang, useT } from '@/services/i18n'
import { cartCount, useCart } from '@/store/cart'
import { useLocation } from '@/store/location'
import { CartNotices } from './CartNotices'
import { CartTotals } from './CartTotals'
import { QtyStepper } from './QtyStepper'

function Line({ line }: { line: CartLineView }) {
  const t = useT()
  const lang = useLang()
  const setQty = useCart((s) => s.setQty)
  const remove = useCart((s) => s.remove)
  const announce = useCart((s) => s.announce)
  const p = line.product
  const name = pick(p.name, lang)
  return (
    <li className="flex gap-3 border-b border-line py-3 last:border-b-0">
      <ProductImage product={p} className="h-14 w-14 shrink-0 bg-cream" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[1rem] leading-snug text-forest">{name}</p>
        <p className="text-[0.75rem] text-charcoal/65">
          {p.brand} · {p.unit} · {formatPaise(p.pricePaise)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <QtyStepper qty={line.qty} max={Math.min(MAX_LINE_QTY, p.eligibility.sellableQty)} name={name} compact onChange={(n) => setQty(p.id, n)} />
          <span className="font-display text-[1rem] tabular-nums">{formatPaise(line.lineTotalPaise)}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            remove(p.id)
            announce(t('removedFromBasket', { name }))
          }}
          className="tap -ml-2 px-2 text-[0.75rem] text-terracotta underline underline-offset-2"
        >
          {t('removeItem')}
        </button>
      </div>
    </li>
  )
}

function Group({ group }: { group: CartStoreGroup }) {
  const t = useT()
  const lang = useLang()
  const live = group.lines.filter((l) => l.status !== 'removed')
  if (live.length === 0) return null
  return (
    <section className="border border-line bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line bg-limestone/60 px-3 py-2">
        <h3 className="font-display text-[1.05rem] text-forest">{pick(group.store.name, lang)}</h3>
        <p className="text-[0.75rem] text-charcoal/70">
          {group.store.etaMin} {t('min')} · {(group.store.distanceM / 1000).toFixed(1)} km
        </p>
      </header>
      <ul className="px-3">
        {live.map((l) => (
          <Line key={l.product.id} line={l} />
        ))}
      </ul>
      <div className="space-y-0.5 border-t border-line px-3 py-2 text-[0.8rem] text-charcoal/80">
        {group.appliedOffers.map((o) => (
          <p key={o.id} className="flex justify-between gap-3 text-olive">
            <span>{pick(o.label, lang)}</span>
            <span className="tabular-nums">−{formatPaise(o.amountPaise)}</span>
          </p>
        ))}
        <p className="flex justify-between gap-3">
          <span>{t('deliveryFee')}</span>
          <span className="tabular-nums">{group.deliveryFeePaise === 0 ? t('freeLabel') : formatPaise(group.deliveryFeePaise)}</span>
        </p>
        {group.freeDeliveryRemainingPaise !== null && group.freeDeliveryRemainingPaise > 0 && (
          <p className="text-[0.75rem] text-terracotta">{t('freeDeliveryHint', { amount: formatPaise(group.freeDeliveryRemainingPaise) })}</p>
        )}
        <p className="flex justify-between gap-3 pt-0.5 font-medium text-forest">
          <span>{pick(group.store.name, lang)}</span>
          <span className="tabular-nums">{formatPaise(group.totalPaise)}</span>
        </p>
      </div>
    </section>
  )
}

/** The basket drawer: grouped by store, with each store's own delivery estimate and fee, and the honest multi-delivery note. */
export function CartDrawer() {
  const t = useT()
  const dialog = useRef<HTMLDialogElement>(null)
  const open = useCart((s) => s.open)
  const setOpen = useCart((s) => s.setOpen)
  const count = useCart((s) => cartCount(s.lines))
  const validation = useCart((s) => s.validation)
  const validating = useCart((s) => s.validating)
  const source = useCart((s) => s.validationSource)
  const hasLocation = useLocation((s) => s.location !== null)
  const openPicker = useLocation((s) => s.openPicker)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      const d0 = dur(0.28)
      if (d0 > 0) gsap.fromTo(d, { x: 36, opacity: 0 }, { x: 0, opacity: 1, duration: d0, ease: ease.studio })
    }
    if (!open && d.open) d.close()
  }, [open])

  const live = validation?.groups.filter((g) => g.itemCount > 0) ?? []
  const savings = live.reduce((n, g) => n + g.mrpSavingsPaise, 0)
  const offline = source === 'local'
  const ready = !!validation && validation.canCheckout && !validating && hasLocation && !offline

  return (
    <dialog
      ref={dialog}
      aria-labelledby="basket-title"
      onClose={() => setOpen(false)}
      onClick={(e) => e.target === dialog.current && setOpen(false)}
      className="m-0 ml-auto h-dvh max-h-dvh w-[min(460px,100vw)] max-w-none overflow-hidden border-l border-line bg-cream p-0 text-charcoal backdrop:bg-forest/55"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 id="basket-title" className="font-display text-[1.4rem] text-forest">
            {t('basketTitle')} <span className="text-[0.9rem] text-charcoal/60">· {t(count === 1 ? 'itemN' : 'itemsN', { n: count })}</span>
          </h2>
          <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="tap -mr-2 px-2 text-xl text-forest/70 hover:text-forest">
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          <CartNotices />
          {offline && <p role="status" className="border-l-2 border-terracotta bg-terracotta/10 px-3 py-2 text-[0.82rem]">{t('offlineBasket')}</p>}

          {count === 0 ? (
            <div className="py-12 text-center">
              <p className="font-display text-[1.2rem] text-forest">{t('basketEmpty')}</p>
              <Link to="/discover" onClick={() => setOpen(false)} className="tap mt-4 inline-flex items-center border border-forest bg-forest px-5 text-[0.9rem] text-cream">
                {t('browseStores')}
              </Link>
            </div>
          ) : !validation ? (
            <p role="status" className="py-10 text-center text-[0.85rem] text-charcoal/65">{t('checkingBasket')}…</p>
          ) : (
            <>
              {validation.multiDelivery && (
                <div className="border border-line bg-limestone/70 px-3 py-2.5 text-[0.82rem]">
                  <p className="font-medium text-forest">{t('multiDeliveryTitle', { n: live.length })}</p>
                  <p className="mt-0.5 text-charcoal/75">{t('multiDeliveryBody')}</p>
                </div>
              )}
              {validation.groups.map((g) => (
                <Group key={g.store.id} group={g} />
              ))}
              <CartTotals
                subtotalPaise={validation.subtotalPaise}
                discountPaise={validation.discountPaise}
                deliveryPaise={validation.deliveryPaise}
                taxPaise={validation.taxPaise}
                totalPaise={validation.totalPaise}
                savingsPaise={savings}
              />
            </>
          )}
        </div>

        {count > 0 && (
          <footer className="shrink-0 border-t border-line bg-cream p-4">
            {!hasLocation && (
              <p className="mb-2 text-[0.8rem] text-terracotta">
                {t('needsLocationCheckout')}{' '}
                <button type="button" onClick={openPicker} className="underline underline-offset-2">
                  {t('chooseLocation')}
                </button>
              </p>
            )}
            {ready ? (
              <Link to="/checkout" onClick={() => setOpen(false)} className="tap flex w-full items-center justify-center border border-forest bg-forest px-4 text-[0.95rem] font-medium text-cream hover:bg-charcoal">
                {t('checkout')} · {formatPaise(validation!.totalPaise)}
              </Link>
            ) : (
              <button type="button" disabled aria-disabled className="tap w-full border border-forest/25 bg-limestone px-4 text-[0.95rem] font-medium text-forest/55">
                {validating ? `${t('checkingBasket')}…` : t('checkout')}
              </button>
            )}
          </footer>
        )}
      </div>
    </dialog>
  )
}
