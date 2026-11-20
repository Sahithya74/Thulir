import { useEffect, useState } from 'react'
import { DEPARTMENT_LABEL, DEPARTMENT_POLICIES, PLATFORM_POLICY, type Department, type ExpiryPolicy, type OwnerStorePolicies } from '@thulir/shared'
import { ActionForm, Btn, ErrorNote, Field, errorText, inputClass, useOwner } from './ownerUi'

const DEPTS: Department[] = ['fresh', 'bakery', 'chilled', 'snacks', 'beverages', 'pantry', 'personal_care', 'household']

/** What applies to a department right now: platform default → department default → this store's choice. */
function effective(policies: OwnerStorePolicies, d: Department): ExpiryPolicy {
  return { ...PLATFORM_POLICY, ...DEPARTMENT_POLICIES[d], ...policies.departments[d] }
}

function Row({ d, policies, onSaved }: { d: Department; policies: OwnerStorePolicies; onSaved: (p: OwnerStorePolicies) => void }) {
  const { api } = useOwner()
  const cur = effective(policies, d)
  const [editing, setEditing] = useState(false)
  const [near, setNear] = useState(String(cur.nearExpiryDays))
  const [low, setLow] = useState(String(cur.lowStockAt))
  const [sell, setSell] = useState(cur.sellNearExpiry)
  const custom = Boolean(policies.departments[d])
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-forest">
            {DEPARTMENT_LABEL[d].en} {custom && <span className="ml-1 text-[0.8rem] font-normal text-terracotta">your setting</span>}
          </p>
          <p className="text-[0.92rem] text-charcoal/75">
            Expiring soon = within {cur.nearExpiryDays} day{cur.nearExpiryDays === 1 ? '' : 's'} · near-expiry stock {cur.sellNearExpiry ? 'is still sold' : 'is held back'} · low stock at {cur.lowStockAt}
          </p>
        </div>
        {!editing && <Btn kind="secondary" onClick={() => setEditing(true)}>Change</Btn>}
      </div>
      {editing && (
        <ActionForm
          title={`Rules for ${DEPARTMENT_LABEL[d].en}`}
          submitLabel="Save rules"
          onCancel={() => setEditing(false)}
          onSubmit={async (reason) => {
            onSaved(await api.setPolicy(d, { nearExpiryDays: Number(near), lowStockAt: Number(low), sellNearExpiry: sell }, reason))
            setEditing(false)
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="“Expiring soon” window (days)" hint={`${policies.limits.nearExpiryDays.min} to ${policies.limits.nearExpiryDays.max}`}>
              <input className={inputClass} inputMode="numeric" value={near} onChange={(e) => setNear(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Low stock at (units)" hint={`${policies.limits.lowStockAt.min} to ${policies.limits.lowStockAt.max}`}>
              <input className={inputClass} inputMode="numeric" value={low} onChange={(e) => setLow(e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={sell} onChange={(e) => setSell(e.target.checked)} className="h-5 w-5 accent-[#202522]" />
            Keep selling stock that is expiring soon (customers see a short-shelf-life note)
          </label>
        </ActionForm>
      )}
    </li>
  )
}

export default function OwnerSettings() {
  const { api } = useOwner()
  const [policies, setPolicies] = useState<OwnerStorePolicies | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    api
      .policies()
      .then(setPolicies)
      .catch((e: unknown) => setErr(errorText(e)))
  }, [api])

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] text-forest">Freshness rules</h1>
      <p className="text-[0.98rem] text-charcoal/80">Set how early stock counts as “expiring soon”, whether it is still sold, and when to warn about low stock. Changes apply to your store only, immediately, and are recorded in the activity log.</p>
      <p className="border-l-4 border-forest/40 bg-white px-3 py-2 text-[0.95rem]">
        Always on, set by the platform: expired stock is never sold, and stock is taken off sale on its expiry day. These cannot be switched off here.
      </p>
      <ErrorNote error={err} />
      {!policies && !err && <p role="status">Loading…</p>}
      {policies && (
        <ul className="divide-y divide-line border border-line bg-white">
          {DEPTS.map((d) => (
            <Row key={d} d={d} policies={policies} onSaved={setPolicies} />
          ))}
        </ul>
      )}
    </div>
  )
}
