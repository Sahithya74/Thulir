import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEPARTMENT_LABEL, type Department, type EligibilityStatus, type OwnerProductRow } from '@thulir/shared'
import { Chip, ErrorNote, STATUS_LABEL, STATUS_TONE, errorText, fmtDate, inputClass, rupees, useOwner } from './ownerUi'

const nearest = (r: OwnerProductRow) =>
  r.batches
    .filter((b) => b.status === 'active' && b.qty > 0 && b.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(b.expiryDate))
    .map((b) => b.expiryDate!)
    .sort()[0] ?? null

export default function OwnerInventory() {
  const { api } = useOwner()
  const [rows, setRows] = useState<OwnerProductRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<EligibilityStatus | ''>('')
  const [dept, setDept] = useState<Department | ''>('')

  useEffect(() => {
    api
      .inventory()
      .then(setRows)
      .catch((e: unknown) => setErr(errorText(e)))
  }, [api])

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return (rows ?? [])
      .filter((r) => (!status || r.status === status) && (!dept || r.product.department === dept))
      .filter((r) => !n || `${r.product.name.en} ${r.product.name.ta} ${r.product.brand}`.toLowerCase().includes(n))
      .sort((a, b) => a.product.name.en.localeCompare(b.product.name.en))
  }, [rows, q, status, dept])

  const depts = [...new Set((rows ?? []).map((r) => r.product.department))]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] text-forest">Stock</h1>
        <Link to="/owner/inventory/new" className="inline-flex min-h-12 items-center border border-forest bg-forest px-4 text-[1rem] font-medium text-cream hover:bg-charcoal">
          + Add a product
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label>
          <span className="sr-only">Search products</span>
          <input className={inputClass} placeholder="Search by name or brand" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as EligibilityStatus | '')}>
            <option value="">Every status</option>
            {(Object.keys(STATUS_LABEL) as EligibilityStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Department</span>
          <select className={inputClass} value={dept} onChange={(e) => setDept(e.target.value as Department | '')}>
            <option value="">Every department</option>
            {depts.map((d) => (
              <option key={d} value={d}>{DEPARTMENT_LABEL[d].en}</option>
            ))}
          </select>
        </label>
      </div>

      <ErrorNote error={err} />
      {!rows && !err && <p role="status">Loading stock…</p>}
      {rows && (
        <p className="text-[0.92rem] text-charcoal/70" aria-live="polite">
          {shown.length} of {rows.length} products
        </p>
      )}

      {/* A real table on wide screens; on phones each row stacks into a card. */}
      <div className="overflow-hidden border border-line bg-white">
        <table className="w-full text-left text-[1rem]">
          <thead className="hidden bg-limestone/60 text-[0.85rem] uppercase tracking-wide text-charcoal/70 md:table-header-group">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">Product</th>
              <th scope="col" className="px-4 py-2 font-semibold">Can sell</th>
              <th scope="col" className="px-4 py-2 font-semibold">Price</th>
              <th scope="col" className="px-4 py-2 font-semibold">Nearest expiry</th>
              <th scope="col" className="px-4 py-2 font-semibold">Status</th>
              <th scope="col" className="px-4 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={r.product.id} className="grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 md:table-row md:p-0">
                <td className="col-span-2 md:px-4 md:py-3">
                  <span className="block font-medium text-forest">{r.product.name.en}</span>
                  <span className="block text-[0.85rem] text-charcoal/65">
                    {r.product.brand} · {r.product.unit} · {DEPARTMENT_LABEL[r.product.department].en}
                  </span>
                </td>
                <td className="tabular-nums md:px-4 md:py-3">
                  <span className="md:hidden text-charcoal/60">Can sell: </span>
                  {r.eligibility.sellableQty}
                  {r.eligibility.totalQty !== r.eligibility.sellableQty && <span className="text-[0.85rem] text-charcoal/60"> of {r.eligibility.totalQty}</span>}
                </td>
                <td className="tabular-nums md:px-4 md:py-3">{rupees(r.product.pricePaise)}</td>
                <td className="md:px-4 md:py-3">
                  <span className="md:hidden text-charcoal/60">Expiry: </span>
                  {r.product.requiresExpiry ? fmtDate(nearest(r)) ?? '—' : 'No expiry'}
                </td>
                <td className="md:px-4 md:py-3">
                  <Chip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Chip>
                </td>
                <td className="col-span-2 md:px-4 md:py-3 md:text-right">
                  <Link to={`/owner/inventory/${r.product.id}`} className="inline-flex min-h-11 items-center border border-forest/40 px-3 text-forest hover:bg-limestone" aria-label={`Manage ${r.product.name.en}`}>
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows && shown.length === 0 && <p className="p-5">No products match.</p>}
      </div>
    </div>
  )
}
