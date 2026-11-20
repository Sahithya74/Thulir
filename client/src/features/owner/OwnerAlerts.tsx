import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { NotificationView } from '@thulir/shared'
import type { NotificationsResponse } from '@/services/ownerApi'
import { Btn, Chip, ErrorNote, errorText, fmtTime, useOwner, type Tone } from './ownerUi'

const TONE: Record<NotificationView['severity'], Tone> = { critical: 'bad', warning: 'warn', info: 'ok' }
const SEV: Record<NotificationView['severity'], string> = { critical: 'Urgent', warning: 'Soon', info: 'For your information' }
const CHANNEL: Record<string, string> = { in_app: 'In app', email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp' }

export default function OwnerAlerts() {
  const { api, refreshUnread } = useOwner()
  const [data, setData] = useState<NotificationsResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = () =>
    api
      .notifications()
      .then(setData)
      .catch((e: unknown) => setErr(errorText(e)))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api])

  const read = async (id: string) => {
    await api.markRead(id).catch(() => undefined)
    await load()
    refreshUnread()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.6rem)] text-forest">Alerts</h1>
        {data && data.unread > 0 && (
          <Btn kind="secondary" onClick={async () => { await api.markAllRead(); await load(); refreshUnread() }}>
            Mark all as read
          </Btn>
        )}
      </div>
      {/* Honest about delivery: nothing is sent by SMS or WhatsApp in this prototype. */}
      <p className="border-l-4 border-forest/40 bg-white px-3 py-2 text-[0.95rem]">
        {data?.channelNote || 'In-app only. Email, SMS and WhatsApp are not connected in this prototype.'}
      </p>
      <ErrorNote error={err} />
      {!data && !err && <p role="status">Loading alerts…</p>}
      {data && data.items.length === 0 && <p className="border border-line bg-white p-5">No alerts.</p>}
      <ul className="space-y-2">
        {data?.items.map((n) => (
          <li key={n.id} className={`border bg-white p-4 ${n.read ? 'border-line opacity-80' : 'border-forest/40'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={TONE[n.severity]}>{SEV[n.severity]}</Chip>
                  {!n.read && <span className="text-[0.8rem] font-semibold uppercase tracking-wide text-terracotta">New</span>}
                </div>
                <p className="mt-1 font-display text-[1.15rem] text-forest">{n.title}</p>
              </div>
              <span className="text-[0.85rem] text-charcoal/60">{fmtTime(n.createdAt)}</span>
            </div>
            <p className="mt-1 text-[0.98rem] text-charcoal/85">{n.body}</p>
            <p className="mt-2 text-[0.8rem] text-charcoal/60">
              {n.deliveries.map((d) => `${CHANNEL[d.channel]}: ${d.status === 'delivered' ? 'shown' : 'not connected'}`).join(' · ')}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {n.productId && (
                <Link to={`/owner/inventory/${n.productId}`} className="inline-flex min-h-11 items-center border border-forest bg-forest px-3 text-cream hover:bg-charcoal">
                  Open product
                </Link>
              )}
              {n.kind === 'order' && (
                <Link to="/owner/orders" className="inline-flex min-h-11 items-center border border-forest bg-forest px-3 text-cream hover:bg-charcoal">
                  Open orders
                </Link>
              )}
              {!n.read && <Btn kind="quiet" onClick={() => read(n.id)}>Mark as read</Btn>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
