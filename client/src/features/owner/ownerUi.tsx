import { createContext, useContext, useState } from 'react'
import type { EligibilityStatus, OwnerBatchRow, OwnerBucket, SessionUser, StoreOrderStatus } from '@thulir/shared'
import { ApiError } from '@/services/api'
import type { OwnerApi } from '@/services/ownerApi'

/* ------------------------------------------------------------------ context */

export interface OwnerCtx {
  user: SessionUser
  storeId: string
  storeName: string
  api: OwnerApi
  unread: number
  refreshUnread: () => void
}

export const OwnerContext = createContext<OwnerCtx | null>(null)
export function useOwner(): OwnerCtx {
  const c = useContext(OwnerContext)
  if (!c) throw new Error('useOwner outside OwnerLayout')
  return c
}

/* ------------------------------------------------------------------ labels */
// Plain words for owners. The portal is English-only in this phase (see README).

export const STATUS_LABEL: Record<EligibilityStatus, string> = {
  eligible: 'On sale',
  low_stock: 'Low stock',
  near_expiry: 'Expiring soon',
  expired: 'Expired — off sale',
  blocked: 'Off sale',
  out_of_stock: 'Out of stock',
  requires_review: 'Needs your review',
}

export const STATUS_TONE: Record<EligibilityStatus, Tone> = {
  eligible: 'ok',
  low_stock: 'warn',
  near_expiry: 'warn',
  expired: 'bad',
  blocked: 'muted',
  out_of_stock: 'muted',
  requires_review: 'bad',
}

export const BATCH_LABEL: Record<OwnerBatchRow['kind'], string> = {
  sellable: 'Good',
  near: 'Expiring soon',
  near_unsold: 'Held back (near expiry)',
  expired: 'Expired',
  expires_today: 'Expires today',
  invalid_expiry: 'Date unreadable',
  missing_expiry: 'No date',
  inactive: 'Blocked',
}

export const BUCKET_INFO: Record<OwnerBucket, { title: string; explain: string; tone: Tone }> = {
  expired: { title: 'Expired', explain: 'Already past the date. Off sale automatically — write it off and take it off the shelf.', tone: 'bad' },
  expires_today: { title: 'Expiring today', explain: 'Blocked from sale today by platform rules.', tone: 'bad' },
  expiring_soon: { title: 'Expiring soon', explain: 'Inside your near-expiry window. Consider a discount or removing it.', tone: 'warn' },
  needs_review: { title: 'Needs your review', explain: 'Cannot be sold until you fix the data or change your rule.', tone: 'bad' },
  invalid_expiry: { title: 'Unreadable expiry dates', explain: 'A batch has no valid date, so it is not for sale. Correct the date.', tone: 'bad' },
  blocked: { title: 'Off sale by you', explain: 'Switched off, marked for removal, or a batch is blocked.', tone: 'muted' },
}

export const ORDER_STATUS_LABEL: Record<StoreOrderStatus, string> = {
  placed: 'New',
  accepted: 'Accepted',
  preparing: 'Being packed',
  ready: 'Ready',
  handed_over: 'Handed to delivery',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const STEP_LABEL: Partial<Record<StoreOrderStatus, string>> = {
  accepted: 'Accept order',
  rejected: 'Reject',
  preparing: 'Start packing',
  ready: 'Mark ready',
  handed_over: 'Hand over to delivery',
}

/* -------------------------------------------------------------- components */

export type Tone = 'ok' | 'warn' | 'bad' | 'muted'
const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-olive/60 bg-olive/10 text-forest',
  warn: 'border-[#b8862f]/60 bg-[#d9b44a]/15 text-forest',
  bad: 'border-terracotta/70 bg-terracotta/12 text-forest',
  muted: 'border-forest/25 bg-limestone text-charcoal/80',
}
const DOT: Record<Tone, string> = { ok: 'bg-olive', warn: 'bg-[#b8862f]', bad: 'bg-terracotta', muted: 'bg-charcoal/40' }

/** Status chip: always words AND colour, never colour alone. */
export function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap border px-2 py-0.5 text-[0.82rem] font-medium ${TONE_CLASS[tone]}`}>
      <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  )
}

export function Btn({ kind = 'primary', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'secondary' | 'danger' | 'quiet' }) {
  const k = {
    primary: 'border-forest bg-forest text-cream hover:bg-charcoal',
    secondary: 'border-forest/40 bg-white text-forest hover:bg-limestone',
    danger: 'border-terracotta bg-white text-[#9a4a26] hover:bg-terracotta/10',
    quiet: 'border-transparent text-forest underline underline-offset-4 hover:bg-forest/5',
  }[kind]
  return <button type="button" {...rest} className={`min-h-12 border px-4 text-[1rem] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${k} ${rest.className ?? ''}`} />
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="border-l-4 border-terracotta bg-terracotta/10 px-3 py-2 text-[0.95rem]">
      {error}
    </p>
  )
}

export const errorText = (e: unknown) =>
  e instanceof ApiError || (e instanceof Error && e.message) ? (e as Error).message : 'Something went wrong. Please try again.'

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[0.95rem] font-medium text-forest">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.85rem] text-charcoal/65">{hint}</span>}
    </label>
  )
}

export const inputClass = 'mt-1 block min-h-12 w-full border border-forest/35 bg-white px-3 text-[1rem] outline-none focus:border-forest'

/**
 * A small form that runs one action. Every change that needs a reason asks for it here — the server refuses it
 * without one, so asking up front saves a round trip.
 */
export function ActionForm({
  title,
  submitLabel,
  danger,
  needsReason = true,
  children,
  onSubmit,
  onCancel,
}: {
  title: string
  submitLabel: string
  danger?: boolean
  needsReason?: boolean
  children?: React.ReactNode
  onSubmit: (reason: string) => Promise<void>
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <form
      className="mt-3 space-y-3 border border-forest/25 bg-cream p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setErr(null)
        if (needsReason && reason.trim().length < 5) {
          setErr('Please give a reason (at least 5 characters).')
          return
        }
        setBusy(true)
        try {
          await onSubmit(reason.trim())
        } catch (x) {
          setErr(errorText(x))
          setBusy(false)
        }
      }}
    >
      <p className="font-display text-[1.15rem] text-forest">{title}</p>
      {children}
      {needsReason && (
        <Field label="Reason" hint="Saved in the activity log with your name.">
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </Field>
      )}
      <ErrorNote error={err} />
      <div className="flex flex-wrap gap-2">
        <Btn type="submit" kind={danger ? 'danger' : 'primary'} disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Btn>
        <Btn kind="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Btn>
      </div>
    </form>
  )
}

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export const fmtDate = (iso: string | null) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(Date.parse(`${iso}T00:00:00Z`))) return iso ?? '—'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
}

export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(iso))

/** Tomorrow in IST as YYYY-MM-DD: the earliest expiry date stock may be received with. */
export function tomorrowIst(): string {
  const ist = new Date(Date.now() + 330 * 60_000)
  ist.setUTCDate(ist.getUTCDate() + 1)
  return ist.toISOString().slice(0, 10)
}
