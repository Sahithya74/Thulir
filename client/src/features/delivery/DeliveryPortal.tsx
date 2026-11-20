import { useCallback, useEffect, useState } from 'react'
import type { PartnerOrderView } from '@thulir/shared'
import { deliveryApi } from '@/services/staffApi'
import { Btn, Chip, ErrorNote, Field, ORDER_STATUS_LABEL, errorText, fmtTime, inputClass, rupees, type Tone } from '@/features/owner/ownerUi'

const ACTIVE = ['ready', 'handed_over', 'out_for_delivery'] as const
const TONE: Record<string, Tone> = { ready: 'warn', handed_over: 'warn', out_for_delivery: 'ok', delivered: 'muted', cancelled: 'bad', rejected: 'bad' }

function OrderCard({ o, onChanged }: { o: PartnerOrderView; onChanged: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null)
    setBusy(true)
    try {
      await fn()
      onChanged()
    } catch (x) {
      setErr(errorText(x))
    } finally {
      setBusy(false)
    }
  }
  return (
    <li className="border border-line bg-white" data-testid="partner-order">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-limestone/60 px-4 py-2.5">
        <p className="font-mono text-[0.9rem] text-forest">{o.id}</p>
        <Chip tone={TONE[o.status] ?? 'muted'}>{ORDER_STATUS_LABEL[o.status]}</Chip>
      </header>
      <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
        <div>
          <p className="eyebrow">Pick up from</p>
          <p className="mt-0.5 font-medium text-forest">{o.store.name.en}</p>
          <p className="text-[0.92rem] text-charcoal/75">{o.store.area.en}</p>
          <p className="mt-2 text-[0.92rem]">{o.itemCount} item{o.itemCount === 1 ? '' : 's'} · ETA {o.etaMin} min</p>
        </div>
        <div>
          <p className="eyebrow">Deliver to</p>
          <p className="mt-0.5 font-medium text-forest">{o.customer.name}</p>
          <p className="text-[0.92rem]">
            {o.customer.line1}, {o.customer.area.en} {o.customer.pincode}
          </p>
          <p className="text-[0.92rem]">
            <a className="underline underline-offset-4" href={`tel:+91${o.customer.phone}`}>
              +91 {o.customer.phone}
            </a>
          </p>
          {o.customer.instructions && <p className="mt-1 text-[0.88rem] text-charcoal/70">“{o.customer.instructions}”</p>}
        </div>
      </div>
      <p className="border-t border-line px-4 py-2 text-[0.95rem]">
        {o.collectPaise > 0 ? (
          <>
            Collect <strong className="tabular-nums">{rupees(o.collectPaise)}</strong> in cash
          </>
        ) : (
          'Already paid (simulated) — collect nothing'
        )}
        <span className="ml-2 text-[0.82rem] text-charcoal/60">· updated {fmtTime(o.updatedAt)}</span>
      </p>
      {o.status === 'ready' && <p className="border-t border-line px-4 py-2 text-[0.92rem] text-charcoal/75">Waiting for the store to hand the bag over.</p>}
      {o.nextSteps.includes('out_for_delivery') && (
        <div className="border-t border-line px-4 py-3">
          <Btn disabled={busy} onClick={() => run(() => deliveryApi.transition(o.id, 'out_for_delivery'))}>
            {busy ? 'Saving…' : 'Picked up — start delivery'}
          </Btn>
        </div>
      )}
      {o.nextSteps.includes('delivered') && (
        <form
          className="flex flex-wrap items-end gap-3 border-t border-line px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => deliveryApi.transition(o.id, 'delivered', code.trim()))
          }}
        >
          <Field label="Customer's 4-digit code" hint="The customer sees it on their order page. Ask for it at the door.">
            <input className={`${inputClass} w-40 font-mono tracking-[0.3em]`} inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Btn type="submit" disabled={busy || code.length !== 4}>
            {busy ? 'Checking…' : 'Mark delivered'}
          </Btn>
        </form>
      )}
      {err && (
        <div className="px-4 pb-3">
          <ErrorNote error={err} />
        </div>
      )}
    </li>
  )
}

/** The delivery partner's day: what to pick up, where to take it, and what is done. */
export default function DeliveryPortal() {
  const [orders, setOrders] = useState<PartnerOrderView[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => {
    deliveryApi
      .orders()
      .then((o) => {
        setOrders(o)
        setErr(null)
      })
      .catch((x) => setErr(errorText(x)))
  }, [])
  useEffect(() => {
    load()
    const t = window.setInterval(load, 15_000)
    return () => window.clearInterval(t)
  }, [load])

  const active = (orders ?? []).filter((o) => (ACTIVE as readonly string[]).includes(o.status))
  const done = (orders ?? []).filter((o) => !(ACTIVE as readonly string[]).includes(o.status))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[2rem] leading-tight text-forest">Your deliveries</h1>
          <p className="text-[0.95rem] text-charcoal/75">Orders are assigned to you when a store marks them ready. Locations are addresses only — there is no live GPS in this prototype.</p>
        </div>
        <Btn kind="secondary" onClick={load}>
          Refresh
        </Btn>
      </div>
      <ErrorNote error={err} />
      {!orders && !err && <p role="status">Loading…</p>}
      <section aria-labelledby="active-h">
        <h2 id="active-h" className="font-display text-[1.35rem] text-forest">
          Active ({active.length})
        </h2>
        {orders && active.length === 0 && <p className="mt-2 text-charcoal/70">Nothing to deliver right now.</p>}
        <ul className="mt-3 grid gap-3">
          {active.map((o) => (
            <OrderCard key={o.id} o={o} onChanged={load} />
          ))}
        </ul>
      </section>
      <section aria-labelledby="done-h">
        <h2 id="done-h" className="font-display text-[1.35rem] text-forest">
          History ({done.length})
        </h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {done.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[0.95rem]">
              <span>
                <span className="font-mono">{o.id}</span> · {o.store.name.en} → {o.customer.area.en}
              </span>
              <Chip tone={TONE[o.status] ?? 'muted'}>{ORDER_STATUS_LABEL[o.status]}</Chip>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
