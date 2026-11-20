import { useEffect, useState } from 'react'
import type { AuditEntryView } from '@thulir/shared'
import { ErrorNote, errorText, fmtTime, useOwner } from './ownerUi'

/** Read-only by design: the activity log cannot be edited or deleted, by owners or by anyone else. */
export default function OwnerActivity() {
  const { api } = useOwner()
  const [rows, setRows] = useState<AuditEntryView[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    api
      .audit(200)
      .then(setRows)
      .catch((e: unknown) => setErr(errorText(e)))
  }, [api])

  return (
    <div className="space-y-5">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] text-forest">Activity</h1>
      <p className="text-[0.98rem] text-charcoal/80">Every change to stock, prices, rules and orders, with who made it and why. This record cannot be edited or deleted.</p>
      <ErrorNote error={err} />
      {!rows && !err && <p role="status">Loading…</p>}
      {rows && rows.length === 0 && <p className="border border-line bg-white p-5">No activity yet.</p>}
      <ol className="divide-y divide-line border border-line bg-white">
        {rows?.map((a) => (
          <li key={a.id} className="px-4 py-3">
            <div className="flex flex-wrap justify-between gap-x-4">
              <p className="font-medium text-forest">{a.summary}</p>
              <time dateTime={a.at} className="text-[0.85rem] text-charcoal/60">{fmtTime(a.at)}</time>
            </div>
            <p className="text-[0.88rem] text-charcoal/70">
              {a.actorName.replace('Demo owner · ', '')}
              {a.reason ? ` — “${a.reason}”` : ''}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}
