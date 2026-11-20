import { useCallback, useEffect, useState } from 'react'
import {
  DEPARTMENT_LABEL,
  DEPARTMENT_POLICIES,
  PLATFORM_POLICY,
  type AdminAnalytics,
  type AdminComplianceRow,
  type AdminOrderRow,
  type AdminStoreRow,
  type Department,
  type ExpiryPolicy,
  type PlatformPolicies,
  type StoreOrderStatus,
} from '@thulir/shared'
import { adminApi, type AdminAuditEntry } from '@/services/staffApi'
import { ActionForm, Btn, Chip, ErrorNote, Field, ORDER_STATUS_LABEL, STATUS_LABEL, errorText, fmtTime, inputClass, rupees, type Tone } from '@/features/owner/ownerUi'

/** Load once, reload on demand. */
function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const load = useCallback(() => {
    fn()
      .then((d) => {
        setData(d)
        setErr(null)
      })
      .catch((x) => setErr(errorText(x)))
  }, [fn])
  useEffect(load, [load])
  return { data, err, load, setData }
}

function Title({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-[2rem] leading-tight text-forest">{children}</h1>
      {sub && <p className="mt-1 max-w-3xl text-[0.95rem] text-charcoal/75">{sub}</p>}
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border border-line bg-white px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-display text-[1.8rem] leading-none text-forest tabular-nums">{value}</p>
      {note && <p className="mt-1 text-[0.82rem] text-charcoal/65">{note}</p>}
    </div>
  )
}

const ORDER_TONE: Partial<Record<StoreOrderStatus, Tone>> = { delivered: 'ok', rejected: 'bad', cancelled: 'bad', placed: 'warn' }

/* ------------------------------------------------------------------ overview */
export function AdminOverview() {
  const { data: a, err } = useLoad<AdminAnalytics>(adminApi.analytics)
  if (err) return <ErrorNote error={err} />
  if (!a) return <p role="status">Loading…</p>
  const max = Math.max(1, ...a.perStore.map((s) => s.gmvPaise))
  return (
    <div>
      <Title sub="Figures come from the demo data and orders placed in this session. Cash orders count as expected value, not money collected.">Overview</Title>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Stores" value={String(a.stores.total)} note={`${a.stores.active} active · ${a.stores.suspended} suspended`} />
        <Stat label="Store orders" value={String(a.orders.total)} note={`${a.orders.cancelledOrRejected} cancelled or rejected`} />
        <Stat label="Order value" value={rupees(a.gmvPaise)} note="Excludes cancelled and rejected" />
        <Stat label="Freshness" value={`${a.freshness.compliancePercent}%`} note={`${a.freshness.sellable} of ${a.freshness.products} products on sale · ${a.freshness.hiddenByChecks} held back by checks`} />
      </div>
      <section className="mt-8">
        <h2 className="font-display text-[1.35rem] text-forest">Order value by store</h2>
        <ul className="mt-3 space-y-2" aria-label="Order value by store">
          {a.perStore.map((s) => (
            <li key={s.storeId} className="grid grid-cols-[minmax(8rem,14rem)_1fr_auto] items-center gap-3 text-[0.92rem]">
              <span className="truncate">{s.name.en}</span>
              <span className="h-3 bg-limestone" aria-hidden>
                <span className="block h-3 bg-olive" style={{ width: `${(s.gmvPaise / max) * 100}%` }} />
              </span>
              <span className="tabular-nums">
                {rupees(s.gmvPaise)} · {s.orders} order{s.orders === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="font-display text-[1.35rem] text-forest">Store orders by status</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(Object.entries(a.orders.byStatus) as [StoreOrderStatus, number][]).map(([s, n]) => (
            <li key={s}>
              <Chip tone={ORDER_TONE[s] ?? 'muted'}>
                {ORDER_STATUS_LABEL[s]}: {n}
              </Chip>
            </li>
          ))}
          {a.orders.total === 0 && <li className="text-charcoal/70">No orders yet.</li>}
        </ul>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ stores */
function StoreRow({ s, onSaved }: { s: AdminStoreRow; onSaved: (r: AdminStoreRow) => void }) {
  const [open, setOpen] = useState(false)
  const suspended = s.status === 'suspended'
  return (
    <li className="px-4 py-3" data-testid="admin-store">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-forest">
            {s.name.en} <span className="text-[0.85rem] font-normal text-charcoal/60">· {s.category}</span>
          </p>
          <p className="mt-1 flex flex-wrap gap-2">
            <Chip tone={suspended ? 'bad' : 'ok'}>{suspended ? 'Suspended — hidden from customers' : 'Active'}</Chip>
            {s.isDemo && <Chip tone="muted">Demo store — not a verified business</Chip>}
          </p>
          <p className="mt-1 text-[0.88rem] text-charcoal/75">
            {s.sellable}/{s.products} products on sale · {s.expiredOrBlocked} expired or blocked · {s.orders} orders ({s.activeOrders} active)
          </p>
        </div>
        {!open && (
          <Btn kind={suspended ? 'secondary' : 'danger'} onClick={() => setOpen(true)}>
            {suspended ? 'Reinstate' : 'Suspend'}
          </Btn>
        )}
      </div>
      {open && (
        <ActionForm
          title={suspended ? `Reinstate ${s.name.en}` : `Suspend ${s.name.en}`}
          submitLabel={suspended ? 'Reinstate store' : 'Suspend store'}
          danger={!suspended}
          onCancel={() => setOpen(false)}
          onSubmit={async (reason) => {
            onSaved(await adminApi.setStoreStatus(s.id, suspended ? 'active' : 'suspended', reason))
            setOpen(false)
          }}
        >
          <p className="text-[0.92rem] text-charcoal/80">
            {suspended
              ? 'Customers will see the store and its products again.'
              : 'The store and its products disappear for customers and new orders are refused. Orders already placed carry on. The owner can still sign in.'}
          </p>
        </ActionForm>
      )}
    </li>
  )
}

export function AdminStores() {
  const { data, err, setData } = useLoad<AdminStoreRow[]>(adminApi.stores)
  return (
    <div>
      <Title sub="Verification is not performed in this prototype, so no store is ever shown as verified. Suspending needs a reason and is recorded in the activity log.">Stores</Title>
      <ErrorNote error={err} />
      {!data && !err && <p role="status">Loading…</p>}
      {data && (
        <ul className="divide-y divide-line border border-line bg-white">
          {data.map((s) => (
            <StoreRow key={s.id} s={s} onSaved={(r) => setData(data.map((x) => (x.id === r.id ? r : x)))} />
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ orders */
function OrderRow({ o, onSaved }: { o: AdminOrderRow; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const cancellable = o.nextSteps.includes('cancelled')
  return (
    <li className="px-4 py-3" data-testid="admin-order">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-[0.95rem]">
          <p>
            <span className="font-mono text-forest">{o.storeOrderId}</span> · {o.storeName.en}
          </p>
          <p className="text-[0.88rem] text-charcoal/75">
            {o.customerName} · {o.customerPhoneMasked} · {o.area.en} · {fmtTime(o.createdAt)} · {rupees(o.totalPaise)} · {o.paymentLabel}
          </p>
          {o.rejectReason && <p className="text-[0.85rem] text-charcoal/70">“{o.rejectReason}”</p>}
        </div>
        <div className="flex items-center gap-2">
          <Chip tone={ORDER_TONE[o.status] ?? 'muted'}>{ORDER_STATUS_LABEL[o.status]}</Chip>
          {cancellable && !open && (
            <Btn kind="danger" onClick={() => setOpen(true)}>
              Cancel
            </Btn>
          )}
        </div>
      </div>
      {open && (
        <ActionForm
          title={`Cancel ${o.storeOrderId}`}
          submitLabel="Cancel this store order"
          danger
          onCancel={() => setOpen(false)}
          onSubmit={async (reason) => {
            await adminApi.cancelOrder(o.storeOrderId, reason)
            setOpen(false)
            onSaved()
          }}
        >
          <p className="text-[0.92rem] text-charcoal/80">Reserved stock goes back on sale. A prepaid amount is recorded as a simulated refund — no money moves.</p>
        </ActionForm>
      )}
    </li>
  )
}

export function AdminOrders() {
  const { data, err, load } = useLoad<AdminOrderRow[]>(adminApi.orders)
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('active')
  const rows = (data ?? []).filter((o) => filter === 'all' || (filter === 'active') === !['delivered', 'cancelled', 'rejected'].includes(o.status))
  return (
    <div>
      <Title sub="Every store order across the platform. Phone numbers are masked. Support can cancel an order until it leaves the store.">Orders</Title>
      <div className="mb-3 flex gap-2" role="group" aria-label="Show">
        {(['active', 'closed', 'all'] as const).map((f) => (
          <Btn key={f} kind={filter === f ? 'primary' : 'secondary'} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'active' ? 'In progress' : f === 'closed' ? 'Finished' : 'All'}
          </Btn>
        ))}
      </div>
      <ErrorNote error={err} />
      {!data && !err && <p role="status">Loading…</p>}
      {data && rows.length === 0 && <p className="text-charcoal/70">No orders here.</p>}
      {rows.length > 0 && (
        <ul className="divide-y divide-line border border-line bg-white">
          {rows.map((o) => (
            <OrderRow key={o.storeOrderId} o={o} onSaved={load} />
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ freshness */
export function AdminCompliance() {
  const { data, err } = useLoad<AdminComplianceRow[]>(adminApi.compliance)
  return (
    <div>
      <Title sub="Products the freshness checks are keeping off sale right now, across every store. Admins cannot edit stock — the owner fixes it in their portal, and every fix is audited.">Freshness &amp; compliance</Title>
      <ErrorNote error={err} />
      {!data && !err && <p role="status">Loading…</p>}
      {data && data.length === 0 && <p>Nothing is being held back.</p>}
      {data && data.length > 0 && (
        <div className="overflow-x-auto border border-line bg-white">
          <table className="w-full min-w-[40rem] text-left text-[0.92rem]">
            <thead className="bg-limestone/70 text-[0.8rem] uppercase tracking-[0.08em] text-charcoal/70">
              <tr>
                <th className="px-3 py-2 font-medium">Store</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((r) => (
                <tr key={`${r.storeId}-${r.productId}`} data-testid="compliance-row">
                  <td className="px-3 py-2">{r.storeName.en}</td>
                  <td className="px-3 py-2">{r.productName}</td>
                  <td className="px-3 py-2">
                    <Chip tone={r.status === 'expired' || r.status === 'requires_review' ? 'bad' : 'muted'}>{STATUS_LABEL[r.status as keyof typeof STATUS_LABEL] ?? r.status}</Chip>
                  </td>
                  <td className="px-3 py-2 text-charcoal/75">{r.reasons.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ rules */
const DEPTS: Department[] = ['fresh', 'bakery', 'chilled', 'snacks', 'beverages', 'pantry', 'personal_care', 'household']

function RuleRow({ d, p, onSaved }: { d: Department; p: PlatformPolicies; onSaved: (p: PlatformPolicies) => void }) {
  const cur: ExpiryPolicy = { ...PLATFORM_POLICY, ...DEPARTMENT_POLICIES[d], ...p.departments[d] }
  const [open, setOpen] = useState(false)
  const [near, setNear] = useState(String(cur.nearExpiryDays))
  const [low, setLow] = useState(String(cur.lowStockAt))
  const [sell, setSell] = useState(cur.sellNearExpiry)
  const [block, setBlock] = useState(cur.blockOnExpiryDay)
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-forest">
            {DEPARTMENT_LABEL[d].en} {p.departments[d] && <span className="ml-1 text-[0.8rem] font-normal text-terracotta">changed by admin</span>}
          </p>
          <p className="text-[0.92rem] text-charcoal/75">
            Near expiry = within {cur.nearExpiryDays} day{cur.nearExpiryDays === 1 ? '' : 's'} · near-expiry stock {cur.sellNearExpiry ? 'sold' : 'held back'} · expiry-day stock {cur.blockOnExpiryDay ? 'blocked' : 'allowed'} · low stock at {cur.lowStockAt}
          </p>
        </div>
        {!open && (
          <Btn kind="secondary" onClick={() => setOpen(true)}>
            Change
          </Btn>
        )}
      </div>
      {open && (
        <ActionForm
          title={`Platform defaults for ${DEPARTMENT_LABEL[d].en}`}
          submitLabel="Save for every store"
          onCancel={() => setOpen(false)}
          onSubmit={async (reason) => {
            onSaved(await adminApi.setPolicy(d, { nearExpiryDays: Number(near), lowStockAt: Number(low), sellNearExpiry: sell, blockOnExpiryDay: block }, reason))
            setOpen(false)
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Near expiry within (days)">
              <input className={inputClass} type="number" min={0} max={90} value={near} onChange={(e) => setNear(e.target.value)} />
            </Field>
            <Field label="Low stock at (units)">
              <input className={inputClass} type="number" min={0} max={100} value={low} onChange={(e) => setLow(e.target.value)} />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={sell} onChange={(e) => setSell(e.target.checked)} /> Near-expiry stock may still be sold
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={block} onChange={(e) => setBlock(e.target.checked)} /> Block stock on its expiry day
          </label>
        </ActionForm>
      )}
    </li>
  )
}

export function AdminRules() {
  const { data, err, setData } = useLoad<PlatformPolicies>(adminApi.policies)
  return (
    <div>
      <Title sub="Platform defaults for every store. A store owner may tighten them for their own store; expired stock is always blocked whatever is set here.">Freshness rules</Title>
      <ErrorNote error={err} />
      {!data && !err && <p role="status">Loading…</p>}
      {data && (
        <ul className="divide-y divide-line border border-line bg-white">
          {DEPTS.map((d) => (
            <RuleRow key={d} d={d} p={data} onSaved={setData} />
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ activity */
export function AdminActivity() {
  const { data, err } = useLoad<AdminAuditEntry[]>(adminApi.audit)
  return (
    <div>
      <Title sub="Append-only log of sign-ins and every change made by owners, partners and admins.">Activity</Title>
      <ErrorNote error={err} />
      {!data && !err && <p role="status">Loading…</p>}
      {data && (
        <ul className="divide-y divide-line border border-line bg-white">
          {data.map((a) => (
            <li key={a.id} className="px-4 py-2.5 text-[0.92rem]">
              <p>
                <span className="text-charcoal/60">{fmtTime(a.at)}</span> · <strong className="font-medium text-forest">{a.actorName}</strong> <span className="text-charcoal/60">({a.actorRole.replace('_', ' ')})</span> — {a.summary}
              </p>
              {a.reason && <p className="text-[0.85rem] text-charcoal/70">Reason: “{a.reason}”</p>}
            </li>
          ))}
          {data.length === 0 && <li className="px-4 py-3 text-charcoal/70">Nothing yet.</li>}
        </ul>
      )}
    </div>
  )
}
