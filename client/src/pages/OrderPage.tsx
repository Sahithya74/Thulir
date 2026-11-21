import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import gsap from 'gsap'
import { CUSTOMER_STAGES, formatPaise, type OrderView, type PaymentStatus, type StoreOrderStatus } from '@thulir/shared'
import { CartTotals } from '@/components/cart/CartTotals'
import { Wordmark } from '@/components/navigation/TopBar'
import { ApiError } from '@/services/api'
import { dur, ease } from '@/services/motion'
import { pick, useLang, useT, type DictKey } from '@/services/i18n'
import { ordersApi } from '@/services/ordersApi'

const PAY_KEY: Record<PaymentStatus, DictKey> = {
  cod_pending: 'payCodPending',
  awaiting_payment: 'payAwaiting',
  paid_simulated: 'payPaidSim',
  failed: 'payFailed',
  void: 'payVoid',
}

const CANCEL_KEY: Record<string, DictKey> = {
  payment_timeout: 'cancelPaymentTimeout',
  items_unavailable: 'cancelItemsUnavailable',
  cancelled_by_customer: 'cancelByCustomer',
  too_many_failed_payments: 'cancelTooManyFailures',
  cancelled_by_support: 'cancelBySupport',
  rejected_by_store: 'cancelByStore',
}

const STAGE: Record<StoreOrderStatus, string> = {
  placed: 'Order placed',
  accepted: 'Store accepted',
  preparing: 'Being packed',
  ready: 'Ready for pickup',
  handed_over: 'With delivery partner',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  rejected: 'Store could not take this order',
  cancelled: 'Cancelled',
}

/** Where this store's part of the order has got to. Simple and readable without any 3D. */
function Progress({ status, history }: { status: StoreOrderStatus; history: { status: StoreOrderStatus; at: string }[] }) {
  if (status === 'rejected' || status === 'cancelled') return null
  const reached = new Set(history.map((h) => h.status))
  const at = (s: StoreOrderStatus) => history.find((h) => h.status === s)?.at
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2 px-4 py-3 text-[0.78rem]" aria-label="Order progress">
      {CUSTOMER_STAGES.map((s, i) => {
        const done = reached.has(s)
        const current = s === status
        return (
          <li key={s} className="flex items-center gap-1" aria-current={current ? 'step' : undefined}>
            <span className={`inline-flex items-center gap-1.5 border px-2 py-1 ${current ? 'border-forest bg-forest text-cream' : done ? 'border-olive/60 bg-olive/10 text-forest' : 'border-line text-charcoal/50'}`}>
              {done && !current && <span aria-hidden>✓</span>}
              {STAGE[s]}
              {at(s) && <span className="opacity-70">· {new Intl.DateTimeFormat('en-IN', { timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(at(s)!))}</span>}
            </span>
            {i < CUSTOMER_STAGES.length - 1 && <span aria-hidden className="text-charcoal/30">→</span>}
          </li>
        )
      })}
    </ol>
  )
}

/** Where the bag is along the way, as a share of the route. Driven by real status changes, not by a location. */
const JOURNEY_AT: Partial<Record<StoreOrderStatus, number>> = { placed: 0, accepted: 0, preparing: 0, ready: 0.04, handed_over: 0.12, out_for_delivery: 0.55, delivered: 1 }

function Journey({ status }: { status: StoreOrderStatus }) {
  const t = JOURNEY_AT[status]
  if (t === undefined) return null
  // quadratic curve store (30,62) → (170,8) → home (310,62)
  const p = (k: number, a: number, b: number, c: number) => (1 - k) * (1 - k) * a + 2 * (1 - k) * k * b + k * k * c
  const x = p(t, 30, 170, 310)
  const y = p(t, 62, 8, 62)
  return (
    <figure className="border-b border-line px-4 py-3" data-testid="journey">
      <svg viewBox="0 0 340 84" className="h-auto w-full max-w-md" role="img" aria-label={`Illustration: the order is ${STAGE[status].toLowerCase()}`}>
        <path d="M30 62 Q170 8 310 62" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" className="text-charcoal/30" />
        <rect x="16" y="56" width="28" height="20" className="fill-forest" />
        <rect x="16" y="52" width="28" height="6" className="fill-terracotta" />
        <path d="M298 62 l12 -11 l12 11 v14 h-24z" className="fill-olive" />
        <circle cx={x} cy={y} r="7" className="fill-terracotta transition-all duration-700 motion-reduce:transition-none" />
        <text x="30" y="83" textAnchor="middle" className="fill-charcoal text-[9px]">Store</text>
        <text x="310" y="83" textAnchor="middle" className="fill-charcoal text-[9px]">You</text>
      </svg>
      <figcaption className="mt-1 text-[0.78rem] text-charcoal/65">Illustrative simulation — not live GPS. It moves only when the store or partner updates the order.</figcaption>
    </figure>
  )
}

const when = (iso: string, lang: string) =>
  new Intl.DateTimeFormat(lang === 'ta' ? 'ta-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso))

/** A single, quiet "store → home" line that draws once. Illustrative only; it is not tracking. */
function RouteLine() {
  const ref = useRef<SVGPathElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const tw = gsap.fromTo(el, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: dur(1.4), ease: ease.studio })
    return () => {
      tw.kill()
    }
  }, [])
  return (
    <svg viewBox="0 0 320 36" className="mt-5 h-9 w-full max-w-sm" fill="none" aria-hidden>
      <circle cx="10" cy="26" r="5" fill="#d94f2b" />
      <path ref={ref} d="M10 26C70 26 80 8 150 8s90 18 160 18" stroke="#3f7a3a" strokeWidth="1.6" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset="0" />
      <path d="M302 20v-7l8-5 8 5v7z" stroke="#2b1a12" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

export default function OrderPage() {
  const t = useT()
  const lang = useLang()
  const { id } = useParams()
  const [order, setOrder] = useState<OrderView | null>(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(
    (signal?: AbortSignal) =>
      ordersApi
        .getOrder(id!, signal)
        .then((o) => {
          setOrder(o)
          setMissing(false)
        })
        .catch((e: unknown) => {
          if ((e as Error).name === 'AbortError') return
          if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setMissing(true)
        }),
    [id],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    void load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  // While payment is pending the server may time the hold out; check back so the page never lies about it.
  useEffect(() => {
    if (order?.status !== 'awaiting_payment') return
    const timer = window.setInterval(() => void load(), 15_000)
    return () => window.clearInterval(timer)
  }, [order?.status, load])

  const act = async (fn: () => Promise<OrderView>) => {
    setBusy(true)
    setNote(null)
    try {
      setOrder(await fn())
    } catch (e) {
      if (e instanceof ApiError && e.details && typeof e.details === 'object' && 'id' in (e.details as object)) {
        setOrder(e.details as OrderView) // e.g. cancelled because items became unavailable
      } else await load()
      setNote(e instanceof ApiError ? e.message : t('orderFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (missing) {
    return (
      <div className="min-h-dvh bg-cream">
        <header className="flex h-14 items-center border-b border-line px-4 sm:px-8"><Wordmark /></header>
        <main className="mx-auto max-w-xl px-6 py-20 text-center">
          <h1 className="font-display text-[1.8rem] text-forest">{t('orderNotFound')}</h1>
          <p className="mt-2 text-[0.88rem] text-charcoal/70">{t('guestNote')}</p>
          <Link to="/discover" className="tap mt-6 inline-flex items-center border border-forest bg-forest px-6 text-cream">{t('browseStores')}</Link>
        </main>
      </div>
    )
  }
  if (!order) {
    return (
      <div className="min-h-dvh bg-cream">
        <header className="flex h-14 items-center border-b border-line px-4 sm:px-8"><Wordmark /></header>
        <p role="status" className="py-24 text-center text-[0.9rem] text-charcoal/65">{t('loadingProducts')}…</p>
      </div>
    )
  }

  const awaiting = order.status === 'awaiting_payment'
  const cancelled = order.status === 'cancelled'
  const heading = awaiting ? t('orderAwaitingPayment') : cancelled ? t('orderCancelled') : order.status === 'completed' ? t('orderDelivered') : t('orderPlaced')
  const savings = 0

  return (
    <div className="min-h-dvh bg-cream">
      <header className="flex h-14 items-center justify-between border-b border-line px-4 sm:px-8">
        <Wordmark />
        <Link to="/orders" className="tap flex items-center px-2 text-[0.82rem] text-forest underline underline-offset-4">{t('myOrders')}</Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-8">
        <p className="eyebrow">{t('orderIdLabel')} · <span className="tabular-nums">{order.id}</span></p>
        <h1 className="mt-1 font-display text-[clamp(2.1rem,6vw,3.4rem)] leading-[1.02] text-forest">{heading}</h1>
        {!awaiting && !cancelled && <RouteLine />}
        <p className="mt-3 border-l-2 border-terracotta bg-terracotta/10 px-3 py-2 text-[0.82rem]">{t('demoCheckoutNote')}</p>

        {note && <p role="alert" className="mt-4 border-l-2 border-terracotta bg-terracotta/10 px-3 py-2 text-[0.88rem]">{note}</p>}

        {cancelled && order.cancelReason && <p role="status" className="mt-4 text-[1rem] text-charcoal/85">{t(CANCEL_KEY[order.cancelReason] ?? 'orderCancelled')}</p>}

        {awaiting && (
          <section aria-labelledby="sim-title" className="mt-6 border-2 border-dashed border-terracotta bg-white p-5">
            <h2 id="sim-title" className="font-display text-[1.3rem] text-terracotta">{t('simBannerTitle')}</h2>
            <p className="mt-1 text-[0.9rem] text-charcoal/80">{t('simBannerBody')}</p>
            {order.reservationExpiresAt && <p className="mt-2 text-[0.82rem] text-charcoal/70">{t('holdUntil', { time: new Intl.DateTimeFormat(lang === 'ta' ? 'ta-IN' : 'en-IN', { timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(order.reservationExpiresAt)) })}</p>}
            {order.payment.status === 'failed' && <p role="alert" className="mt-2 text-[0.88rem] font-medium text-terracotta">{t('payFailed')}. {t('retryPayment')}.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => act(() => ordersApi.simulatePayment(order.id, 'success'))} className="tap border border-forest bg-forest px-5 text-[0.92rem] text-cream hover:bg-charcoal disabled:opacity-50">{t('simSuccess')}</button>
              <button type="button" disabled={busy} onClick={() => act(() => ordersApi.simulatePayment(order.id, 'failure'))} className="tap border border-forest/40 px-5 text-[0.92rem] text-forest hover:bg-forest/10 disabled:opacity-50">{t('simFail')}</button>
              <button type="button" disabled={busy} onClick={() => act(() => ordersApi.cancelOrder(order.id))} className="tap px-3 text-[0.85rem] text-terracotta underline underline-offset-2 disabled:opacity-50">{t('cancelOrderBtn')}</button>
            </div>
          </section>
        )}

        <dl className="mt-8 grid gap-x-8 gap-y-4 border-y border-line py-5 sm:grid-cols-2">
          <div>
            <dt className="eyebrow">{t('orderStatusLabel')}</dt>
            <dd className="mt-0.5 text-[0.98rem]">{awaiting ? t('statusAwaiting') : cancelled ? t('statusCancelled') : t('statusConfirmed')} · <span className="text-charcoal/65">{when(order.createdAt, lang)}</span></dd>
          </div>
          <div>
            <dt className="eyebrow">{t('paymentLabel')}</dt>
            <dd className="mt-0.5 text-[0.98rem]">
              {order.payment.methodLabel} · {t(PAY_KEY[order.payment.status])}
              {order.payment.simulated && <span className="ml-2 border border-terracotta px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-terracotta">Simulation</span>}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">{t('slotLabelPrefix')}</dt>
            <dd className="mt-0.5 text-[0.98rem]">{order.slotLabel}</dd>
          </div>
          <div>
            <dt className="eyebrow">{t('deliveringTo')}</dt>
            <dd className="mt-0.5 text-[0.98rem]">
              {order.address.name}<br />
              {order.address.line1}, {pick(order.address.area, lang)}, {pick(order.address.town, lang)} {order.address.pincode}
              {order.address.instructions && <span className="block text-[0.85rem] text-charcoal/65">“{order.address.instructions}”</span>}
            </dd>
          </div>
        </dl>

        <h2 className="mt-8 font-display text-[1.4rem] text-forest">{t('deliveriesTitle')}</h2>
        {order.multiDelivery && <p className="mt-1 text-[0.85rem] text-charcoal/75">{t('multiDeliveryBody')}</p>}
        <div className="mt-3 grid gap-3">
          {order.storeOrders.map((so) => (
            <section key={so.id} className="border border-line bg-white">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line bg-limestone/60 px-4 py-2.5">
                <h3 className="font-display text-[1.1rem] text-forest">{pick(so.store.name, lang)}</h3>
                <p className="text-[0.78rem] text-charcoal/70">
                  {so.status === 'rejected' || so.status === 'cancelled' ? STAGE[so.status] : !cancelled && t('estArrival', { n: so.etaMin })}
                </p>
              </header>
              {!cancelled && <Progress status={so.status} history={so.history} />}
              {!cancelled && <Journey status={so.status} />}
              {so.deliveryCode && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-olive/10 px-4 py-3" data-testid="delivery-code">
                  <p className="text-[0.92rem]">
                    Delivery code{so.partnerName ? ` for ${so.partnerName}` : ''}:
                  </p>
                  <p className="font-mono text-[1.6rem] tracking-[0.35em] text-forest">{so.deliveryCode}</p>
                  <p className="w-full text-[0.8rem] text-charcoal/70">Give it to the delivery partner only when your bag is in your hands. Thulir never asks for it by phone.</p>
                </div>
              )}
              {so.status === 'cancelled' && !cancelled && (
                <div className="border-b border-line bg-terracotta/10 px-4 py-2 text-[0.88rem]">
                  <p className="text-charcoal/75">Thulir support cancelled this part of your order{so.refundSimulatedPaise > 0 ? ` — a refund of ${formatPaise(so.refundSimulatedPaise)} was recorded (simulated, no money moves)` : '. Nothing was charged for it'}.</p>
                </div>
              )}
              {so.status === 'rejected' && (
                <div className="border-b border-line bg-terracotta/10 px-4 py-2 text-[0.88rem]">
                  {so.rejectReason && <p>“{so.rejectReason}”</p>}
                  <p className="text-charcoal/75">These items were not charged{so.refundSimulatedPaise > 0 ? ` — a refund of ${formatPaise(so.refundSimulatedPaise)} was recorded (simulated, no money moves)` : ''}.</p>
                </div>
              )}
              <ul className="px-4">
                {so.items.map((i) => (
                  <li key={i.productId} className="flex justify-between gap-3 border-b border-line py-2 text-[0.92rem] last:border-b-0">
                    <span>{i.qty} × {pick(i.name, lang)} <span className="text-charcoal/55">· {i.brand} · {i.unit}</span></span>
                    <span className="tabular-nums">{formatPaise(i.lineTotalPaise)}</span>
                  </li>
                ))}
              </ul>
              <div className="space-y-0.5 border-t border-line px-4 py-2 text-[0.82rem] text-charcoal/75">
                {so.offerDiscountPaise > 0 && (
                  <p className="flex justify-between gap-3 text-olive">
                    <span>{t('offersLabel')}</span>
                    <span className="tabular-nums">−{formatPaise(so.offerDiscountPaise)}</span>
                  </p>
                )}
                <p className="flex justify-between gap-3">
                  <span>{t('deliveryFee')}</span>
                  <span className="tabular-nums">{so.deliveryFeePaise === 0 ? t('freeLabel') : formatPaise(so.deliveryFeePaise)}</span>
                </p>
                <p className="flex justify-between gap-3 font-medium text-forest">
                  <span>{pick(so.store.name, lang)}</span>
                  <span className="tabular-nums">{formatPaise(so.totalPaise)}</span>
                </p>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-5">
          <CartTotals subtotalPaise={order.subtotalPaise} discountPaise={order.discountPaise} deliveryPaise={order.deliveryPaise} taxPaise={order.taxPaise} totalPaise={order.totalPaise} savingsPaise={savings} />
        </div>

        <div className="mt-8 grid gap-3 border-t border-line pt-5 text-[0.85rem] text-charcoal/75">
          {!awaiting && !cancelled && <p>{t('trackSoon')}</p>}
          <p>{t('guestNote')}</p>
          <p><span className="font-medium text-forest">{t('supportTitle')}.</span> {t('supportBody')}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/discover" className="tap inline-flex items-center border border-forest bg-forest px-6 text-[0.92rem] text-cream hover:bg-charcoal">{t('continueShopping')}</Link>
          <Link to="/orders" className="tap inline-flex items-center border border-forest/40 px-6 text-[0.92rem] text-forest hover:bg-forest/10">{t('myOrders')}</Link>
        </div>
      </main>
    </div>
  )
}
