import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPaise, type OrderView } from '@thulir/shared'
import { Wordmark } from '@/components/navigation/TopBar'
import { useLang, useT, pick } from '@/services/i18n'
import { ordersApi } from '@/services/ordersApi'

export default function OrdersPage() {
  const t = useT()
  const lang = useLang()
  const [orders, setOrders] = useState<OrderView[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    ordersApi
      .listOrders(ctrl.signal)
      .then(setOrders)
      .catch((e: unknown) => (e as Error).name !== 'AbortError' && setFailed(true))
    return () => ctrl.abort()
  }, [])

  return (
    <div className="min-h-dvh bg-cream">
      <header className="flex h-14 items-center justify-between border-b border-line px-4 sm:px-8">
        <Wordmark />
        <Link to="/discover" className="tap flex items-center px-2 text-[0.82rem] text-forest underline underline-offset-4">{t('browseStores')}</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-8">
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-none text-forest">{t('myOrders')}</h1>
        <p className="mt-2 text-[0.82rem] text-charcoal/70">{t('guestNote')}</p>

        {failed && <p role="alert" className="mt-6 text-[0.9rem] text-terracotta">{t('apiDown')}</p>}
        {!orders && !failed && <p role="status" className="mt-6 text-[0.85rem] text-charcoal/65">{t('loadingProducts')}…</p>}
        {orders && orders.length === 0 && <p className="mt-8 border border-dashed border-forest/25 px-4 py-10 text-center text-[0.9rem] text-charcoal/70">{t('noOrders')}</p>}

        <ul className="mt-6">
          {orders?.map((o) => (
            <li key={o.id} className="border-b border-line">
              <Link to={`/order/${o.id}`} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4 hover:bg-limestone/60">
                <span>
                  <span className="block font-display text-[1.15rem] text-forest tabular-nums">{o.id}</span>
                  <span className="block text-[0.8rem] text-charcoal/65">
                    {o.storeOrders.map((s) => pick(s.store.name, lang)).join(' · ')}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-display text-[1.1rem] tabular-nums">{formatPaise(o.totalPaise)}</span>
                  <span className="block text-[0.78rem] text-charcoal/65">
                    {o.status === 'confirmed' ? t('statusConfirmed') : o.status === 'completed' ? t('statusCompleted') : o.status === 'cancelled' ? t('statusCancelled') : t('statusAwaiting')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
