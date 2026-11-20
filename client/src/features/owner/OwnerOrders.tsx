import { useCallback, useEffect, useState } from 'react'
import type { OwnerStoreOrderView, StoreOrderStatus } from '@thulir/shared'
import { ActionForm, Btn, Chip, ErrorNote, ORDER_STATUS_LABEL, STEP_LABEL, errorText, fmtTime, rupees, useOwner, type Tone } from './ownerUi'

const TABS = [
  { id: 'new', label: 'New', statuses: ['placed'] },
  { id: 'active', label: 'In progress', statuses: ['accepted', 'preparing', 'ready'] },
  { id: 'done', label: 'Done', statuses: ['handed_over', 'out_for_delivery', 'delivered', 'rejected', 'cancelled'] },
] as const

const toneOf = (s: StoreOrderStatus): Tone => (s === 'placed' ? 'warn' : s === 'rejected' || s === 'cancelled' ? 'muted' : 'ok')

function OrderCard({ o, onChange }: { o: OwnerStoreOrderView; onChange: (next: OwnerStoreOrderView) => void }) {
  const { api, refreshUnread } = useOwner()
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState<StoreOrderStatus | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const forward = o.nextSteps.filter((s) => s !== 'rejected')

  const go = async (to: StoreOrderStatus, reason?: string) => {
    setErr(null)
    setBusy(to)
    try {
      onChange(await api.transition(o.id, to, reason))
      refreshUnread()
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const n = o.items.reduce((c, i) => c + i.qty, 0)
  return (
    <article className="border border-line bg-white p-4" aria-labelledby={`o-${o.id}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`o-${o.id}`} className="font-display text-[1.25rem] tabular-nums text-forest">
            {o.id}
          </h3>
          <p className="text-[0.92rem] text-charcoal/75">
            {o.customerFirstName} · {o.area.en} · {fmtTime(o.createdAt)}
          </p>
        </div>
        <Chip tone={toneOf(o.status)}>{ORDER_STATUS_LABEL[o.status]}</Chip>
      </header>

      <ul className="mt-3 divide-y divide-line border-y border-line">
        {o.items.map((i) => (
          <li key={i.productId} className="flex justify-between gap-3 py-2 text-[1rem]">
            <span>
              <strong className="tabular-nums">{i.qty} ×</strong> {i.name.en} <span className="text-charcoal/60">· {i.unit}</span>
            </span>
            <span className="tabular-nums">{rupees(i.pricePaise * i.qty)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap justify-between gap-2 text-[0.95rem]">
        <span className="text-charcoal/75">
          {n} item{n === 1 ? '' : 's'} · {o.slotLabel} · {o.paymentLabel}
        </span>
        <strong className="tabular-nums">{rupees(o.totalPaise)}</strong>
      </p>
      {o.instructions && <p className="mt-1 text-[0.9rem] text-charcoal/70">Note from customer: “{o.instructions}”</p>}
      {o.rejectReason && <p className="mt-2 text-[0.92rem]">You rejected this: “{o.rejectReason}”</p>}

      <ErrorNote error={err} />
      {(forward.length > 0 || o.nextSteps.includes('rejected')) && !rejecting && (
        <div className="mt-3 flex flex-wrap gap-2">
          {forward.map((s) => (
            <Btn key={s} onClick={() => go(s)} disabled={busy !== null}>
              {busy === s ? 'Saving…' : STEP_LABEL[s] ?? s}
            </Btn>
          ))}
          {o.nextSteps.includes('rejected') && (
            <Btn kind="danger" onClick={() => setRejecting(true)} disabled={busy !== null}>
              Reject
            </Btn>
          )}
        </div>
      )}
      {rejecting && (
        <ActionForm
          title="Reject this order"
          submitLabel="Reject order"
          danger
          onCancel={() => setRejecting(false)}
          onSubmit={async (reason) => {
            onChange(await api.transition(o.id, 'rejected', reason))
            setRejecting(false)
          }}
        >
          <p className="text-[0.92rem] text-charcoal/80">The customer sees your reason. The items go back into your stock.</p>
        </ActionForm>
      )}
    </article>
  )
}

export default function OwnerOrders() {
  const { api } = useOwner()
  const [orders, setOrders] = useState<OwnerStoreOrderView[] | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('new')
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(
    () =>
      api
        .orders()
        .then((x) => {
          setOrders(x)
          setErr(null)
        })
        .catch((e: unknown) => setErr(errorText(e))),
    [api],
  )
  useEffect(() => {
    void load()
    const t = window.setInterval(load, 10_000) // new orders appear without a reload
    return () => window.clearInterval(t)
  }, [load])

  const current = TABS.find((t) => t.id === tab)!
  const shown = (orders ?? []).filter((o) => (current.statuses as readonly string[]).includes(o.status))
  const count = (id: (typeof TABS)[number]['id']) => (orders ?? []).filter((o) => (TABS.find((t) => t.id === id)!.statuses as readonly string[]).includes(o.status)).length

  return (
    <div className="space-y-5">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] text-forest">Orders</h1>
      <div role="tablist" aria-label="Order lists" className="flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-12 border-b-[3px] px-4 text-[1rem] font-medium ${tab === t.id ? 'border-terracotta text-forest' : 'border-transparent text-charcoal/70'}`}
          >
            {t.label} <span className="tabular-nums text-charcoal/55">{count(t.id)}</span>
          </button>
        ))}
      </div>
      <ErrorNote error={err} />
      {!orders && !err && <p role="status">Loading orders…</p>}
      {orders && shown.length === 0 && <p className="border border-line bg-white p-5 text-[1rem]">No orders here.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((o) => (
          <OrderCard key={o.id} o={o} onChange={(next) => setOrders((list) => (list ?? []).map((x) => (x.id === next.id ? next : x)))} />
        ))}
      </div>
    </div>
  )
}
