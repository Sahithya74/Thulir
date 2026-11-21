import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DEPARTMENT_LABEL, type Department, type PackShape } from '@thulir/shared'
import { Btn, ErrorNote, Field, errorText, inputClass, tomorrowIst, useOwner } from './ownerUi'

const DEPTS: Department[] = ['fresh', 'pantry', 'chilled', 'household', 'personal_care', 'snacks', 'beverages', 'bakery']
const SHAPES: [PackShape, string][] = [
  ['pouch', 'Pouch / packet'],
  ['box', 'Box'],
  ['bottle', 'Bottle'],
  ['jar', 'Jar'],
  ['carton', 'Carton'],
  ['tub', 'Tub / cup'],
  ['bar', 'Bar / small pack'],
  ['crate', 'Loose (crate)'],
]

export default function OwnerProductNew() {
  const { api, refreshUnread } = useOwner()
  const nav = useNavigate()
  const [f, setF] = useState({ en: '', ta: '', brand: '', department: 'pantry' as Department, unit: '', price: '', mrp: '', description: '', shape: 'pouch' as PackShape, veg: true, requiresExpiry: true, batchNo: '', qty: '', expiry: '' })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      const withBatch = f.batchNo.trim() !== '' || f.qty !== ''
      const row = await api.createProduct({
        name: { en: f.en, ta: f.ta },
        brand: f.brand,
        department: f.department,
        unit: f.unit,
        pricePaise: Math.round(Number(f.price) * 100),
        mrpPaise: Math.round(Number(f.mrp) * 100),
        description: f.description,
        shape: f.shape,
        tags: [],
        veg: f.veg,
        requiresExpiry: f.requiresExpiry,
        ...(withBatch ? { initialBatch: { batchNo: f.batchNo, qty: Number(f.qty), expiryDate: f.requiresExpiry ? f.expiry : null } } : {}),
      })
      refreshUnread()
      nav(`/owner/inventory/${row.product.id}`, { replace: true })
    } catch (x) {
      setErr(errorText(x))
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Link to="/owner/inventory" className="inline-flex min-h-11 items-center text-[0.95rem] text-forest underline underline-offset-4">← All stock</Link>
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] text-forest">Add a product</h1>
      <form onSubmit={submit} className="space-y-5 border border-line bg-white p-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name (English)"><input className={inputClass} value={f.en} onChange={(e) => set('en', e.target.value)} maxLength={80} /></Field>
          <Field label="Name (Tamil, optional)"><input className={inputClass} lang="ta" value={f.ta} onChange={(e) => set('ta', e.target.value)} maxLength={80} /></Field>
          <Field label="Brand"><input className={inputClass} value={f.brand} onChange={(e) => set('brand', e.target.value)} maxLength={40} /></Field>
          <Field label="Pack size" hint='With a number, e.g. "500 g" or "1 litre".'><input className={inputClass} value={f.unit} onChange={(e) => set('unit', e.target.value)} maxLength={20} /></Field>
          <Field label="Department">
            <select className={inputClass} value={f.department} onChange={(e) => set('department', e.target.value as Department)}>
              {DEPTS.map((d) => <option key={d} value={d}>{DEPARTMENT_LABEL[d].en}</option>)}
            </select>
          </Field>
          <Field label="Pack type" hint="Used to draw the product until you add a photo.">
            <select className={inputClass} value={f.shape} onChange={(e) => set('shape', e.target.value as PackShape)}>
              {SHAPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Selling price (₹)"><input className={inputClass} inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
          <Field label="MRP (₹)" hint="The selling price cannot be higher than the MRP."><input className={inputClass} inputMode="decimal" value={f.mrp} onChange={(e) => set('mrp', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
        </div>
        <Field label="Description (optional)"><textarea className={`${inputClass} py-2`} rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={300} /></Field>
        <fieldset className="flex flex-wrap gap-6">
          <legend className="sr-only">Product type</legend>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={f.veg} onChange={(e) => set('veg', e.target.checked)} className="h-5 w-5 accent-[#0f2a43]" /> Vegetarian</label>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={f.requiresExpiry} onChange={(e) => set('requiresExpiry', e.target.checked)} className="h-5 w-5 accent-[#0f2a43]" /> Has an expiry date</label>
        </fieldset>
        {!f.requiresExpiry && <p className="text-[0.88rem] text-charcoal/70">Only for goods that never expire (scrub pads, brooms). This cannot be changed later except by the platform.</p>}

        <fieldset className="border-t border-line pt-4">
          <legend className="font-display text-[1.15rem] text-forest">First stock (optional)</legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-3">
            <Field label="Batch number"><input className={inputClass} value={f.batchNo} onChange={(e) => set('batchNo', e.target.value)} maxLength={30} /></Field>
            <Field label="Quantity"><input className={inputClass} inputMode="numeric" value={f.qty} onChange={(e) => set('qty', e.target.value.replace(/\D/g, ''))} /></Field>
            {f.requiresExpiry && (
              <Field label="Expiry date" hint="Must be after today."><input className={inputClass} type="date" min={tomorrowIst()} value={f.expiry} onChange={(e) => set('expiry', e.target.value)} /></Field>
            )}
          </div>
        </fieldset>

        <ErrorNote error={err} />
        <Btn type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add product'}</Btn>
      </form>
    </div>
  )
}
