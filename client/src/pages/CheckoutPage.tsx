import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  availableSlotStarts,
  findArea,
  formatMobile,
  formatPaise,
  normaliseIndianMobile,
  type CartValidation,
  type PaymentMethodId,
  type PaymentMethodInfo,
  type SlotChoice,
} from '@thulir/shared'
import { CartNotices } from '@/components/cart/CartNotices'
import { CartTotals } from '@/components/cart/CartTotals'
import { Wordmark } from '@/components/navigation/TopBar'
import { ApiError } from '@/services/api'
import { pick, useLang, useT, type DictKey } from '@/services/i18n'
import { ordersApi } from '@/services/ordersApi'
import { useCart } from '@/store/cart'
import { newIdempotencyKey } from '@/store/guest'
import { useLocation } from '@/store/location'
import { useStores } from '@/store/stores'

type Field = 'name' | 'phone' | 'instructions'
type Errors = Partial<Record<Field, DictKey>>

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-forest/25 py-6">
      <h2 className="flex items-baseline gap-3 font-display text-[1.35rem] text-forest">
        <span className="text-[0.85rem] text-terracotta tabular-nums">{String(n).padStart(2, '0')}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

const input = 'tap w-full border border-forest/35 bg-white px-3 text-[1rem] outline-none focus:border-forest aria-[invalid=true]:border-terracotta'

export default function CheckoutPage() {
  const t = useT()
  const lang = useLang()
  const nav = useNavigate()
  const lines = useCart((s) => s.lines)
  const validation = useCart((s) => s.validation)
  const validating = useCart((s) => s.validating)
  const source = useCart((s) => s.validationSource)
  const applyValidation = useCart((s) => s.applyValidation)
  const clearCart = useCart((s) => s.clear)
  const setDrawer = useCart((s) => s.setOpen)
  const stores = useStores((s) => s.stores)
  const towns = useLocation((s) => s.towns)
  const location = useLocation((s) => s.location)
  const addresses = useLocation((s) => s.addresses)
  const openPicker = useLocation((s) => s.openPicker)

  const address = addresses.find((a) => a.id === location?.addressId)
  const area = address ? findArea(towns, address.areaId) : undefined

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [instructions, setInstructions] = useState('')
  const [slot, setSlot] = useState<SlotChoice>({ kind: 'asap' })
  const [method, setMethod] = useState<PaymentMethodId>('cod')
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const pendingKey = useRef<string | null>(null)

  const [methods, setMethods] = useState<PaymentMethodInfo[] | null>(null)
  const [methodsFailed, setMethodsFailed] = useState(false)
  useEffect(() => {
    const ctrl = new AbortController()
    ordersApi
      .paymentMethods(ctrl.signal)
      .then(setMethods)
      .catch((e: unknown) => (e as Error).name !== 'AbortError' && setMethodsFailed(true))
    return () => ctrl.abort()
  }, [])

  const live = validation?.groups.filter((g) => g.itemCount > 0) ?? []
  const hours = useMemo(() => live.map((g) => stores.find((s) => s.id === g.store.id)?.hours).filter((h): h is NonNullable<typeof h> => !!h), [live, stores])
  const slotStarts = useMemo(() => availableSlotStarts(hours), [hours])
  // If the chosen window stops being offered (time passed, basket changed), fall back to ASAP rather than submit it.
  useEffect(() => {
    if (slot.kind === 'window' && !slotStarts.includes(slot.startHour)) setSlot({ kind: 'asap' })
  }, [slot, slotStarts])

  const offline = source === 'local'
  const ready = !!validation && validation.canCheckout && !validating && !!address && !offline && !methodsFailed

  const validate = (): { name: string; phone: string; instructions: string } | null => {
    const e: Errors = {}
    const n = name.replace(/\s+/g, ' ').trim()
    if (n.length < 2 || n.length > 60) e.name = 'errName'
    const p = normaliseIndianMobile(phone)
    if (!p) e.phone = 'errMobile'
    const ins = instructions.replace(/\s+/g, ' ').trim()
    if (ins.length > 200) e.instructions = 'errInstructions'
    setErrors(e)
    return Object.keys(e).length === 0 && p ? { name: n, phone: p, instructions: ins } : null
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setFormError(null)
    const v = validate()
    if (!v || !address || !validation) return
    setSubmitting(true)
    const key = (pendingKey.current ??= newIdempotencyKey())
    try {
      const order = await ordersApi.createOrder({
        lines,
        address: { name: v.name, phone: v.phone, line1: address.line1, areaId: address.areaId, pincode: address.pincode, instructions: v.instructions },
        slot,
        paymentMethod: method,
        idempotencyKey: key,
      })
      pendingKey.current = null
      clearCart()
      nav(`/order/${order.id}`, { replace: true })
    } catch (e) {
      if (!(e instanceof ApiError)) {
        pendingKey.current = null
        setFormError(t('orderFailed'))
      } else if (e.status === 0) {
        // Outcome unknown: keep the key so a retry is de-duplicated by the server instead of creating a second order.
        setFormError(t('apiDown'))
      } else {
        pendingKey.current = null
        if (e.code === 'CART_CHANGED' && e.details) {
          applyValidation(e.details as CartValidation, 'api')
          setFormError(t('basketChanged'))
        } else if (e.code === 'TOO_MANY_REQUESTS') setFormError(t('tooManyRequests'))
        else if (e.code === 'VALIDATION_FAILED' && Array.isArray(e.details)) {
          const next: Errors = {}
          for (const issue of e.details as { path?: (string | number)[] }[]) {
            const f = issue.path?.[1]
            if (f === 'name') next.name = 'errName'
            if (f === 'phone') next.phone = 'errMobile'
            if (f === 'instructions') next.instructions = 'errInstructions'
          }
          setErrors(next)
          setFormError(t('orderFailed'))
        } else setFormError(e.message || t('orderFailed'))
      }
      setSubmitting(false)
    }
  }

  if (lines.length === 0 && !submitting) {
    return (
      <div className="min-h-dvh bg-cream">
        <header className="flex h-14 items-center border-b border-line px-4 sm:px-8">
          <Wordmark />
        </header>
        <main className="mx-auto max-w-xl px-6 py-20 text-center">
          <h1 className="font-display text-[1.8rem] text-forest">{t('emptyCheckout')}</h1>
          <Link to="/discover" className="tap mt-6 inline-flex items-center border border-forest bg-forest px-6 text-cream">{t('browseStores')}</Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-cream">
      <header className="flex h-14 items-center justify-between border-b border-line px-4 sm:px-8">
        <Wordmark />
        <button type="button" onClick={() => { setDrawer(true); nav('/discover') }} className="tap px-2 text-[0.82rem] text-forest underline underline-offset-4">
          {t('backToBasket')}
        </button>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-8">
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-none text-forest">{t('checkoutTitle')}</h1>
        <p className="mt-3 border-l-2 border-terracotta bg-terracotta/10 px-3 py-2 text-[0.85rem]">{t('demoCheckoutNote')}</p>

        <form onSubmit={submit} noValidate className="mt-6 grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <div className="space-y-3 pb-4">
              <CartNotices />
              {offline && <p role="alert" className="border-l-2 border-terracotta bg-terracotta/10 px-3 py-2 text-[0.85rem]">{t('offlineBasket')}</p>}
              {formError && <p role="alert" className="border-l-2 border-terracotta bg-terracotta/10 px-3 py-2 text-[0.88rem] font-medium">{formError}</p>}
            </div>

            <Section n={1} title={t('sectionAddress')}>
              {address && area ? (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-[0.95rem]">
                    <p className="font-medium text-forest">{address.line1}</p>
                    <p className="text-charcoal/75">{pick(area.name, lang)} · {address.pincode}</p>
                  </div>
                  <button type="button" onClick={openPicker} className="tap border border-forest/40 px-4 text-[0.85rem] text-forest hover:bg-forest/10">{t('changeAddress')}</button>
                </div>
              ) : (
                <div>
                  <p className="text-[0.92rem] text-charcoal/80">{t('noAddress')}</p>
                  <button type="button" onClick={openPicker} className="tap mt-3 border border-forest bg-forest px-5 text-[0.9rem] text-cream">{t('addAddress')}</button>
                </div>
              )}
            </Section>

            <Section n={2} title={t('sectionContact')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="co-name" className="text-[0.82rem] font-medium">{t('fullName')}</label>
                  <input id="co-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'co-name-err' : undefined} className={`${input} mt-1`} />
                  {errors.name && <p id="co-name-err" className="mt-1 text-[0.8rem] text-terracotta">{t(errors.name)}</p>}
                </div>
                <div>
                  <label htmlFor="co-phone" className="text-[0.82rem] font-medium">{t('mobileNumber')}</label>
                  <input id="co-phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" maxLength={24} aria-invalid={Boolean(errors.phone)} aria-describedby="co-phone-hint" className={`${input} mt-1`} />
                  <p id="co-phone-hint" className={`mt-1 text-[0.78rem] ${errors.phone ? 'text-terracotta' : 'text-charcoal/60'}`}>{errors.phone ? t(errors.phone) : t('mobileHint')}</p>
                </div>
              </div>
              <div className="mt-4">
                <label htmlFor="co-ins" className="text-[0.82rem] font-medium">{t('instructionsLabel')}</label>
                <textarea id="co-ins" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} maxLength={220} aria-invalid={Boolean(errors.instructions)} className={`${input} mt-1 py-2`} />
                {errors.instructions && <p className="mt-1 text-[0.8rem] text-terracotta">{t(errors.instructions)}</p>}
              </div>
            </Section>

            <Section n={3} title={t('sectionSlot')}>
              <fieldset>
                <legend className="sr-only">{t('sectionSlot')}</legend>
                <div className="flex flex-wrap gap-2">
                  <label className={`tap flex cursor-pointer items-center border px-4 text-[0.9rem] ${slot.kind === 'asap' ? 'border-forest bg-forest text-cream' : 'border-forest/35 hover:border-forest'}`}>
                    <input type="radio" name="slot" className="sr-only" checked={slot.kind === 'asap'} onChange={() => setSlot({ kind: 'asap' })} />
                    {t('slotAsap')}
                  </label>
                  {slotStarts.map((h) => {
                    const on = slot.kind === 'window' && slot.startHour === h
                    return (
                      <label key={h} className={`tap flex cursor-pointer items-center border px-4 text-[0.9rem] tabular-nums ${on ? 'border-forest bg-forest text-cream' : 'border-forest/35 hover:border-forest'}`}>
                        <input type="radio" name="slot" className="sr-only" checked={on} onChange={() => setSlot({ kind: 'window', startHour: h })} />
                        {t('slotWindow', { from: String(h).padStart(2, '0'), to: String(h + 1).padStart(2, '0') })}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            </Section>

            <Section n={4} title={t('sectionPayment')}>
              {methodsFailed && <p role="alert" className="text-[0.88rem] text-terracotta">{t('apiDown')}</p>}
              {!methods && !methodsFailed && <p role="status" className="text-[0.85rem] text-charcoal/65">{t('loadingProducts')}…</p>}
              <fieldset>
                <legend className="sr-only">{t('sectionPayment')}</legend>
                <div className="grid gap-2">
                  {methods?.map((m) => (
                    <label key={m.id} className={`flex cursor-pointer items-start gap-3 border px-4 py-3 ${method === m.id ? 'border-forest bg-limestone' : 'border-forest/30 hover:border-forest/60'}`}>
                      <input type="radio" name="pay" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1 accent-[#202522]" />
                      <span>
                        <span className="flex flex-wrap items-center gap-2 text-[0.98rem] font-medium text-forest">
                          {m.label}
                          {m.simulated && <span className="border border-terracotta px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-terracotta">Simulation</span>}
                        </span>
                        <span className="mt-0.5 block text-[0.82rem] text-charcoal/70">{m.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Section>
          </div>

          {/* summary */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="border border-line bg-white p-5">
              <h2 className="font-display text-[1.35rem] text-forest">{t('sectionSummary')}</h2>
              {live.length > 1 && <p className="mt-2 bg-limestone/70 px-3 py-2 text-[0.8rem] text-charcoal/80">{t('multiDeliveryTitle', { n: live.length })}. {t('multiDeliveryBody')}</p>}
              {!validation ? (
                <p role="status" className="py-6 text-[0.85rem] text-charcoal/65">{t('checkingBasket')}…</p>
              ) : (
                <>
                  {live.map((g) => (
                    <div key={g.store.id} className="mt-4">
                      <p className="flex items-baseline justify-between gap-2 border-b border-line pb-1 font-medium text-forest">
                        <span>{pick(g.store.name, lang)}</span>
                        <span className="text-[0.75rem] font-normal text-charcoal/65">{g.store.etaMin} {t('min')}</span>
                      </p>
                      <ul className="mt-1 text-[0.85rem]">
                        {g.lines.filter((l) => l.status !== 'removed').map((l) => (
                          <li key={l.product.id} className="flex justify-between gap-3 py-0.5">
                            <span className="min-w-0 truncate">{l.qty} × {pick(l.product.name, lang)} <span className="text-charcoal/55">· {l.product.unit}</span></span>
                            <span className="tabular-nums">{formatPaise(l.lineTotalPaise)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-0.5 flex justify-between text-[0.78rem] text-charcoal/70">
                        <span>{t('deliveryFee')}</span>
                        <span className="tabular-nums">{g.deliveryFeePaise === 0 ? t('freeLabel') : formatPaise(g.deliveryFeePaise)}</span>
                      </p>
                    </div>
                  ))}
                  <div className="mt-4">
                    <CartTotals subtotalPaise={validation.subtotalPaise} discountPaise={validation.discountPaise} deliveryPaise={validation.deliveryPaise} taxPaise={validation.taxPaise} totalPaise={validation.totalPaise} />
                  </div>
                </>
              )}
              <button type="submit" disabled={!ready || submitting} className="tap mt-5 flex w-full items-center justify-center border border-forest bg-forest px-4 text-[1rem] font-medium text-cream transition-colors hover:bg-charcoal disabled:cursor-not-allowed disabled:border-forest/25 disabled:bg-limestone disabled:text-forest/55">
                {submitting ? `${t('placingOrder')}…` : `${t('placeOrder')}${validation ? ` · ${formatPaise(validation.totalPaise)}` : ''}`}
              </button>
              {!address && <p className="mt-2 text-[0.78rem] text-terracotta">{t('noAddress')}</p>}
              {phone && normaliseIndianMobile(phone) && <p className="mt-2 text-[0.75rem] text-charcoal/55">{formatMobile(normaliseIndianMobile(phone)!)}</p>}
            </div>
          </aside>
        </form>
      </main>
    </div>
  )
}
