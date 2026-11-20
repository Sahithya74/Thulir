import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { OwnerBucket, OwnerProductRow } from '@thulir/shared'
import { BATCH_LABEL, BUCKET_INFO, Btn, Chip, ErrorNote, errorText, fmtDate, useOwner } from './ownerUi'

/** Which batches explain why a product is in a given list. */
function relevantBatches(r: OwnerProductRow, b: OwnerBucket) {
  const kinds: Record<OwnerBucket, string[]> = {
    expired: ['expired'],
    expires_today: ['expires_today'],
    expiring_soon: ['near', 'near_unsold'],
    needs_review: ['near_unsold', 'invalid_expiry', 'missing_expiry'],
    invalid_expiry: ['invalid_expiry', 'missing_expiry'],
    blocked: ['inactive'],
  }
  return r.batches.filter((x) => kinds[b].includes(x.kind) && x.status !== 'removed')
}

export default function OwnerExpiry() {
  const { api, refreshUnread } = useOwner()
  const [data, setData] = useState<{ order: OwnerBucket[]; buckets: Record<OwnerBucket, OwnerProductRow[]> } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [scanNote, setScanNote] = useState<string | null>(null)

  const load = () =>
    api
      .expiry()
      .then(setData)
      .catch((e: unknown) => setErr(errorText(e)))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] text-forest">Expiry</h1>
          <p className="mt-1 max-w-2xl text-[0.98rem] text-charcoal/75">
            Most urgent first. The server checks every batch against your rules each time anyone loads the shop, so expired stock is already off sale — these lists tell you what to take off the shelf and what to fix.
          </p>
        </div>
        <Btn
          kind="secondary"
          onClick={async () => {
            setScanNote(null)
            try {
              const r = await api.scan()
              setScanNote(r.created === 0 ? 'Checked. No new problems.' : `Checked. ${r.created} new alert${r.created === 1 ? '' : 's'}.`)
              refreshUnread()
              await load()
            } catch (e) {
              setErr(errorText(e))
            }
          }}
        >
          Check again now
        </Btn>
      </div>
      {scanNote && <p role="status" className="text-[0.95rem] text-olive">{scanNote}</p>}
      <ErrorNote error={err} />
      {!data && !err && <p role="status">Loading…</p>}

      {data?.order.map((b) => {
        const rows = data.buckets[b]
        const info = BUCKET_INFO[b]
        return (
          <section key={b} id={b} aria-labelledby={`h-${b}`} className="scroll-mt-4 border border-line bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 id={`h-${b}`} className="flex items-center gap-3">
                <Chip tone={rows.length ? info.tone : 'muted'}>{info.title}</Chip>
                <span className="font-display text-[1.4rem] tabular-nums text-forest">{rows.length}</span>
              </h2>
              <p className="text-[0.9rem] text-charcoal/70">{info.explain}</p>
            </header>
            {rows.length === 0 ? (
              <p className="px-4 py-3 text-[0.95rem] text-charcoal/65">Nothing here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((r) => (
                  <li key={r.product.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium text-forest">{r.product.name.en} <span className="font-normal text-charcoal/60">· {r.product.unit}</span></p>
                      <ul className="text-[0.9rem] text-charcoal/75">
                        {relevantBatches(r, b).map((x) => (
                          <li key={x.id}>
                            Batch {x.batchNo}: {x.qty} unit{x.qty === 1 ? '' : 's'}, {x.expiryDate ? `expires ${fmtDate(x.expiryDate)}` : 'no date'} — {x.status === 'blocked' ? 'blocked by you' : BATCH_LABEL[x.kind].toLowerCase()}
                          </li>
                        ))}
                        {b === 'blocked' && !r.product.available && <li>Switched off by you</li>}
                        {b === 'blocked' && r.product.flaggedForRemoval && <li>Marked for removal</li>}
                        {b === 'blocked' && r.batches.length > 0 && r.batches.every((x) => x.status === 'removed') && <li>All stock written off — receive fresh stock to sell it again</li>}
                      </ul>
                    </div>
                    <Link to={`/owner/inventory/${r.product.id}`} className="inline-flex min-h-11 items-center border border-forest bg-forest px-4 text-cream hover:bg-charcoal" aria-label={`Fix ${r.product.name.en}`}>
                      Fix
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
