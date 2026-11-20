import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { OWNER_BUCKET_ORDER, type OwnerDashboardData } from '@thulir/shared'
import { BUCKET_INFO, Chip, ErrorNote, errorText, fmtTime, rupees, useOwner } from './ownerUi'

function Stat({ label, value, to, note }: { label: string; value: string | number; to?: string; note?: string }) {
  const body = (
    <>
      <span className="block text-[0.95rem] text-charcoal/75">{label}</span>
      <span className="mt-1 block font-display text-[2.2rem] leading-none tabular-nums text-forest">{value}</span>
      {note && <span className="mt-1 block text-[0.8rem] text-charcoal/60">{note}</span>}
    </>
  )
  return to ? (
    <Link to={to} className="block border border-line bg-white p-4 hover:border-forest/50">
      {body}
    </Link>
  ) : (
    <div className="border border-line bg-white p-4">{body}</div>
  )
}

export default function OwnerDashboard() {
  const { api, storeName } = useOwner()
  const [d, setD] = useState<OwnerDashboardData | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const load = () =>
      api
        .dashboard()
        .then((x) => {
          setD(x)
          setErr(null)
        })
        .catch((e: unknown) => setErr(errorText(e)))
    void load()
    const t = window.setInterval(load, 20_000)
    return () => window.clearInterval(t)
  }, [api])

  if (err) return <ErrorNote error={err} />
  if (!d) return <p role="status">Loading today…</p>

  const urgent = OWNER_BUCKET_ORDER.filter((b) => b !== 'blocked' && d.buckets[b] > 0)

  return (
    <div className="space-y-8">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] leading-tight text-forest">Today at {storeName}</h1>

      <section aria-labelledby="orders-h">
        <h2 id="orders-h" className="eyebrow">Orders</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="New — waiting for you" value={d.pendingOrders} to="/owner/orders" />
          <Stat label="Being handled" value={d.inProgressOrders} to="/owner/orders" />
          <Stat label="Handed to delivery" value={d.completedOrders} to="/owner/orders" />
          <Stat label="Sales today" value={rupees(d.salesTodayPaise)} note={`${d.ordersToday} order${d.ordersToday === 1 ? '' : 's'} · cash orders not yet collected`} />
        </div>
      </section>

      <section aria-labelledby="fresh-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="fresh-h" className="eyebrow">Freshness — needs attention</h2>
          <Link to="/owner/expiry" className="text-[0.95rem] text-forest underline underline-offset-4">Open expiry list</Link>
        </div>
        {urgent.length === 0 ? (
          <p className="mt-2 border border-line bg-white p-4 text-[1rem]">Nothing needs attention right now.</p>
        ) : (
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {urgent.map((b) => (
              <li key={b}>
                <Link to={`/owner/expiry#${b}`} className="flex items-center justify-between gap-3 border border-line bg-white p-4 hover:border-forest/50">
                  <span>
                    <Chip tone={BUCKET_INFO[b].tone}>{BUCKET_INFO[b].title}</Chip>
                    <span className="mt-1 block text-[0.88rem] text-charcoal/70">{BUCKET_INFO[b].explain}</span>
                  </span>
                  <span className="font-display text-[2rem] tabular-nums text-forest">{d.buckets[b]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="stock-h">
        <h2 id="stock-h" className="eyebrow">Stock</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Products on sale" value={d.activeProducts} to="/owner/inventory" />
          <Stat label="Low stock" value={d.lowStock} to="/owner/inventory" />
          <Stat label="Out of stock" value={d.outOfStock} to="/owner/inventory" />
          <Stat label="Unread alerts" value={d.unreadNotifications} to="/owner/alerts" />
        </div>
      </section>

      <section aria-labelledby="recent-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recent-h" className="eyebrow">Recent activity</h2>
          <Link to="/owner/activity" className="text-[0.95rem] text-forest underline underline-offset-4">All activity</Link>
        </div>
        {d.recent.length === 0 ? (
          <p className="mt-2 text-[0.95rem] text-charcoal/70">No changes yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line border-y border-line bg-white">
            {d.recent.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-x-4 px-3 py-2.5">
                <span>{a.summary}</span>
                <span className="text-[0.85rem] text-charcoal/60">{a.actorName.replace('Demo owner · ', '')} · {fmtTime(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
