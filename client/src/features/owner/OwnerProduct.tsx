import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { OwnerBatchRow, OwnerProductRow } from '@thulir/shared'
import { DEPARTMENT_LABEL } from '@thulir/shared'
import { ProductArt } from '@/components/products/ProductArt'
import {
  ActionForm,
  BATCH_LABEL,
  BUCKET_INFO,
  Btn,
  Chip,
  ErrorNote,
  Field,
  STATUS_LABEL,
  STATUS_TONE,
  errorText,
  fmtDate,
  inputClass,
  rupees,
  tomorrowIst,
  useOwner,
  type Tone,
} from './ownerUi'

type Action =
  | { kind: 'receive' }
  | { kind: 'edit' }
  | { kind: 'off' }
  | { kind: 'flag' }
  | { kind: 'unflag' }
  | { kind: 'adjust'; b: OwnerBatchRow }
  | { kind: 'date'; b: OwnerBatchRow }
  | { kind: 'block'; b: OwnerBatchRow }
  | { kind: 'writeoff'; b: OwnerBatchRow }

const batchTone = (b: OwnerBatchRow): Tone =>
  b.status === 'removed' ? 'muted' : b.kind === 'sellable' ? 'ok' : b.kind === 'near' ? 'warn' : b.kind === 'inactive' ? 'muted' : 'bad'

const batchLabel = (b: OwnerBatchRow) => (b.status === 'removed' ? 'Written off' : b.status === 'blocked' ? 'Blocked by you' : BATCH_LABEL[b.kind])

/** Expired (or expiring-today) stock cannot be re-dated — the server refuses it, so the UI says so up front. */
const dateLocked = (b: OwnerBatchRow) => b.kind === 'expired' || b.kind === 'expires_today'

export default function OwnerProduct() {
  const { pid } = useParams()
  const { api, refreshUnread } = useOwner()
  const [row, setRow] = useState<OwnerProductRow | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [action, setAction] = useState<Action | null>(null)
  const [photoErr, setPhotoErr] = useState<string | null>(null)

  useEffect(() => {
    api
      .product(pid!)
      .then(setRow)
      .catch((e: unknown) => setErr(errorText(e)))
  }, [api, pid])

  if (err) return <ErrorNote error={err} />
  if (!row) return <p role="status">Loading product…</p>
  const p = row.product
  const done = (next: OwnerProductRow) => {
    setRow(next)
    setAction(null)
    refreshUnread()
  }

  return (
    <div className="space-y-6">
      <Link to="/owner/inventory" className="inline-flex min-h-11 items-center text-[0.95rem] text-forest underline underline-offset-4">
        ← All stock
      </Link>

      <section className="grid gap-5 border border-line bg-white p-5 md:grid-cols-[180px_1fr]">
        <div>
          <div className="grid aspect-square place-items-center bg-cream">
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.name.en} className="h-full w-full object-contain" />
            ) : (
              <ProductArt product={p} label={p.name.en} className="h-[80%] w-auto" />
            )}
          </div>
          <label className="mt-2 block text-[0.9rem]">
            <span className="text-forest underline underline-offset-4">{p.imageUrl ? 'Change photo' : 'Add a photo'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                setPhotoErr(null)
                if (f.size > 1024 * 1024) return setPhotoErr('Photos must be 1 MB or smaller.')
                try {
                  setRow(await api.uploadImage(p.id, f))
                } catch (x) {
                  setPhotoErr(errorText(x))
                }
              }}
            />
          </label>
          <p className="text-[0.8rem] text-charcoal/60">PNG, JPEG or WebP, up to 1 MB.</p>
          <ErrorNote error={photoErr} />
        </div>

        <div>
          <p className="eyebrow">{DEPARTMENT_LABEL[p.department].en}</p>
          <h1 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] leading-tight text-forest">{p.name.en}</h1>
          <p className="text-[1rem] text-charcoal/75">
            {p.brand} · {p.unit} · {rupees(p.pricePaise)} <span className="text-charcoal/55">(MRP {rupees(p.mrpPaise)})</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Chip>
            {!p.available && <Chip tone="muted">Switched off by you</Chip>}
            {p.flaggedForRemoval && <Chip tone="bad">Marked for removal</Chip>}
            {/* The status chip already says "expired"/"needs review"; only add worklists that tell the owner something new. */}
            {row.buckets.filter((b) => b !== 'blocked' && !(b === 'expired' && row.status === 'expired') && !(b === 'needs_review' && row.status === 'requires_review')).map((b) => (
              <Chip key={b} tone={BUCKET_INFO[b].tone}>{BUCKET_INFO[b].title}</Chip>
            ))}
          </div>
          <p className="mt-3 text-[0.95rem]">
            <strong className="tabular-nums">{row.eligibility.sellableQty}</strong> can be sold now ·{' '}
            <span className="tabular-nums">{row.eligibility.totalQty}</span> on hand
          </p>
          <p className="mt-1 text-[0.85rem] text-charcoal/65">
            {p.requiresExpiry
              ? `Rules: “expiring soon” = within ${row.policy.nearExpiryDays} day${row.policy.nearExpiryDays === 1 ? '' : 's'}; near-expiry stock is ${row.policy.sellNearExpiry ? 'still sold' : 'held back'}; stock is blocked on its expiry day; low stock at ${row.policy.lowStockAt}.`
              : `This product carries no expiry date. Low stock at ${row.policy.lowStockAt}.`}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Btn onClick={() => setAction({ kind: 'receive' })}>Receive stock</Btn>
            <Btn kind="secondary" onClick={() => setAction({ kind: 'edit' })}>Edit price & details</Btn>
            {p.available ? (
              <Btn kind="secondary" onClick={() => setAction({ kind: 'off' })}>Take off sale</Btn>
            ) : (
              <Btn kind="secondary" onClick={async () => done(await api.setAvailability(p.id, true))}>Put back on sale</Btn>
            )}
            {p.flaggedForRemoval ? (
              <Btn kind="secondary" onClick={() => setAction({ kind: 'unflag' })}>Clear removal mark</Btn>
            ) : (
              <Btn kind="danger" onClick={() => setAction({ kind: 'flag' })}>Mark for removal</Btn>
            )}
          </div>
          {!p.available && (
            <p className="mt-2 text-[0.85rem] text-charcoal/65">Putting a product back on sale does not override freshness: expired or undated stock stays off sale.</p>
          )}
        </div>
      </section>

      {action?.kind === 'receive' && <ReceiveForm row={row} onDone={done} onCancel={() => setAction(null)} />}
      {action?.kind === 'edit' && <EditForm row={row} onDone={done} onCancel={() => setAction(null)} />}
      {action?.kind === 'off' && (
        <ActionForm title="Take this product off sale" submitLabel="Take off sale" onCancel={() => setAction(null)} onSubmit={async (r) => done(await api.setAvailability(p.id, false, r))} />
      )}
      {action?.kind === 'flag' && (
        <ActionForm title="Mark for removal" submitLabel="Mark for removal" danger onCancel={() => setAction(null)} onSubmit={async (r) => done(await api.setFlag(p.id, true, r))}>
          <p className="text-[0.92rem]">Customers stop seeing it immediately.</p>
        </ActionForm>
      )}
      {action?.kind === 'unflag' && (
        <ActionForm title="Clear the removal mark" submitLabel="Clear mark" onCancel={() => setAction(null)} onSubmit={async (r) => done(await api.setFlag(p.id, false, r))} />
      )}

      <section aria-labelledby="batches-h" className="border border-line bg-white">
        <h2 id="batches-h" className="border-b border-line px-4 py-3 font-display text-[1.3rem] text-forest">Batches</h2>
        {row.batches.length === 0 && <p className="px-4 py-4">No stock received yet.</p>}
        <ul className="divide-y divide-line">
          {row.batches.map((b) => (
            <li key={b.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-forest">Batch {b.batchNo}</p>
                  <p className="text-[0.92rem] text-charcoal/75">
                    <span className="tabular-nums">{b.qty}</span> on hand
                    {p.requiresExpiry && (
                      <>
                        {' '}· expires {fmtDate(b.expiryDate)}
                        {b.daysToExpiry !== null && b.daysToExpiry >= 0 && <span className="text-charcoal/60"> ({b.daysToExpiry === 0 ? 'today' : `${b.daysToExpiry} day${b.daysToExpiry === 1 ? '' : 's'}`})</span>}
                      </>
                    )}
                  </p>
                </div>
                <Chip tone={batchTone(b)}>{batchLabel(b)}</Chip>
              </div>
              {b.status !== 'removed' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Btn kind="secondary" onClick={() => setAction({ kind: 'adjust', b })}>Adjust quantity</Btn>
                  {p.requiresExpiry && (
                    <Btn kind="secondary" disabled={dateLocked(b)} onClick={() => setAction({ kind: 'date', b })} title={dateLocked(b) ? 'Expired stock cannot be re-dated' : undefined}>
                      Correct date
                    </Btn>
                  )}
                  {b.status === 'active' ? (
                    <Btn kind="secondary" onClick={() => setAction({ kind: 'block', b })}>Block batch</Btn>
                  ) : (
                    <Btn kind="secondary" onClick={async () => done(await api.batchStatus(p.id, b.id, 'active'))}>Unblock</Btn>
                  )}
                  <Btn kind="danger" onClick={() => setAction({ kind: 'writeoff', b })}>Write off</Btn>
                </div>
              )}
              {p.requiresExpiry && dateLocked(b) && b.status !== 'removed' && (
                <p className="mt-2 text-[0.85rem] text-charcoal/70">Expired stock cannot be re-dated. Write this batch off and receive fresh stock instead.</p>
              )}
              {action && 'b' in action && action.b.id === b.id && (
                <BatchAction action={action} productId={p.id} onDone={done} onCancel={() => setAction(null)} />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function BatchAction({ action, productId, onDone, onCancel }: { action: Exclude<Action, { kind: 'receive' | 'edit' | 'off' | 'flag' | 'unflag' }>; productId: string; onDone: (r: OwnerProductRow) => void; onCancel: () => void }) {
  const { api } = useOwner()
  const [delta, setDelta] = useState('')
  const [date, setDate] = useState('')
  const b = action.b
  if (action.kind === 'adjust')
    return (
      <ActionForm
        title={`Adjust batch ${b.batchNo}`}
        submitLabel="Save adjustment"
        onCancel={onCancel}
        onSubmit={async (r) => {
          const d = Number(delta)
          if (!Number.isInteger(d) || d === 0) throw new Error('Enter a whole number, e.g. -3 or 5.')
          onDone(await api.adjust(productId, b.id, d, r))
        }}
      >
        <Field label="Change in quantity" hint={`Use a minus sign to remove, e.g. -3. Now: ${b.qty}.`}>
          <input className={inputClass} inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ''))} />
        </Field>
      </ActionForm>
    )
  if (action.kind === 'date')
    return (
      <ActionForm title={`Correct the date of batch ${b.batchNo}`} submitLabel="Save date" onCancel={onCancel} onSubmit={async (r) => onDone(await api.correctExpiry(productId, b.id, date, r))}>
        <Field label="Correct expiry date" hint="Must be after today.">
          <input className={inputClass} type="date" min={tomorrowIst()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </ActionForm>
    )
  if (action.kind === 'block')
    return <ActionForm title={`Block batch ${b.batchNo}`} submitLabel="Block batch" onCancel={onCancel} onSubmit={async (r) => onDone(await api.batchStatus(productId, b.id, 'blocked', r))} />
  return (
    <ActionForm title={`Write off batch ${b.batchNo}`} submitLabel="Write off" danger onCancel={onCancel} onSubmit={async (r) => onDone(await api.batchStatus(productId, b.id, 'removed', r))}>
      <p className="text-[0.92rem]">This is permanent: a written-off batch can never be sold again.</p>
    </ActionForm>
  )
}

function ReceiveForm({ row, onDone, onCancel }: { row: OwnerProductRow; onDone: (r: OwnerProductRow) => void; onCancel: () => void }) {
  const { api } = useOwner()
  const [batchNo, setBatchNo] = useState('')
  const [qty, setQty] = useState('')
  const [date, setDate] = useState('')
  const needsDate = row.product.requiresExpiry
  return (
    <ActionForm
      title="Receive stock"
      submitLabel="Add to stock"
      needsReason={false}
      onCancel={onCancel}
      onSubmit={async () => onDone(await api.receive(row.product.id, { batchNo, qty: Number(qty), expiryDate: needsDate ? date : null }))}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Batch number">
          <input className={inputClass} value={batchNo} onChange={(e) => setBatchNo(e.target.value)} maxLength={30} />
        </Field>
        <Field label="Quantity">
          <input className={inputClass} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} />
        </Field>
        {needsDate && (
          <Field label="Expiry date" hint="Already-expired stock cannot be received.">
            <input className={inputClass} type="date" min={tomorrowIst()} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}
      </div>
    </ActionForm>
  )
}

function EditForm({ row, onDone, onCancel }: { row: OwnerProductRow; onDone: (r: OwnerProductRow) => void; onCancel: () => void }) {
  const { api } = useOwner()
  const p = row.product
  const [name, setName] = useState(p.name.en)
  const [price, setPrice] = useState(String(p.pricePaise / 100))
  const [mrp, setMrp] = useState(String(p.mrpPaise / 100))
  const [unit, setUnit] = useState(p.unit)
  const [description, setDescription] = useState(p.description)
  return (
    <ActionForm
      title="Edit price & details"
      submitLabel="Save changes"
      needsReason={false}
      onCancel={onCancel}
      onSubmit={async () =>
        onDone(
          await api.updateProduct(p.id, {
            name: { en: name, ta: p.name.ta },
            unit,
            description,
            pricePaise: Math.round(Number(price) * 100),
            mrpPaise: Math.round(Number(mrp) * 100),
          }),
        )
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Pack size" hint='With a number, e.g. "500 g".'>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} />
        </Field>
        <Field label="Selling price (₹)">
          <input className={inputClass} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
        </Field>
        <Field label="MRP (₹)" hint="The selling price cannot be higher than the MRP.">
          <input className={inputClass} inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value.replace(/[^\d.]/g, ''))} />
        </Field>
      </div>
      <Field label="Description">
        <textarea className={`${inputClass} py-2`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
      </Field>
      <p className="text-[0.85rem] text-charcoal/65">Whether a product carries an expiry date can only be changed by the platform.</p>
    </ActionForm>
  )
}
