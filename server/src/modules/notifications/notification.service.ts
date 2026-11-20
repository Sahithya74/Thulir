import { randomBytes } from 'node:crypto'
import type { NotificationChannelId, NotificationSeverity, NotificationView } from '@thulir/shared'

/**
 * Notification abstraction. A channel either really delivers or says it did not.
 *
 * Only the in-app channel is real in this prototype. Email, SMS and WhatsApp are stubs that return `not_configured`:
 * they never claim a message was sent, and the UI says "in-app only". Connecting a real provider means implementing
 * `NotificationChannel` for it and registering it here — nothing else changes.
 */
export interface NotificationChannel {
  readonly id: NotificationChannelId
  deliver(n: NotificationRecord): 'delivered' | 'not_configured'
}

class InAppChannel implements NotificationChannel {
  readonly id = 'in_app' as const
  deliver() {
    return 'delivered' as const
  }
}

class UnconnectedChannel implements NotificationChannel {
  readonly id: NotificationChannelId
  constructor(id: NotificationChannelId) {
    this.id = id
  }
  deliver() {
    return 'not_configured' as const
  }
}

export const defaultChannels = (): NotificationChannel[] => [
  new InAppChannel(),
  new UnconnectedChannel('email'),
  new UnconnectedChannel('sms'),
  new UnconnectedChannel('whatsapp'),
]

export interface NotificationRecord {
  id: string
  storeId: string
  kind: NotificationView['kind']
  severity: NotificationSeverity
  title: string
  body: string
  productId: string | null
  orderId: string | null
  createdAt: string
  readAt: string | null
  /** Same situation, same key: it is announced once, not on every scan. */
  dedupeKey: string
  deliveries: NotificationView['deliveries']
}

export interface NotificationInput {
  storeId: string
  kind: NotificationRecord['kind']
  severity: NotificationSeverity
  title: string
  body: string
  productId?: string
  orderId?: string
  dedupeKey: string
}

export interface NotificationService {
  /** Returns the created notification, or null if this exact situation was already announced. */
  send(input: NotificationInput, at: Date): NotificationRecord | null
  list(storeId: string, limit?: number): NotificationView[]
  unreadCount(storeId: string): number
  markRead(storeId: string, id: string, at: Date): boolean
  markAllRead(storeId: string, at: Date): number
}

export function createNotificationService(channels: NotificationChannel[] = defaultChannels()): NotificationService {
  const rows: NotificationRecord[] = []
  const seen = new Set<string>()

  const view = (n: NotificationRecord): NotificationView => ({
    id: n.id,
    kind: n.kind,
    severity: n.severity,
    title: n.title,
    body: n.body,
    productId: n.productId,
    orderId: n.orderId,
    createdAt: n.createdAt,
    read: n.readAt !== null,
    deliveries: n.deliveries,
  })

  return {
    send(input, at) {
      const key = `${input.storeId}|${input.dedupeKey}`
      if (seen.has(key)) return null
      seen.add(key)
      const rec: NotificationRecord = {
        id: `NTF-${randomBytes(5).toString('hex').toUpperCase()}`,
        storeId: input.storeId,
        kind: input.kind,
        severity: input.severity,
        title: input.title,
        body: input.body,
        productId: input.productId ?? null,
        orderId: input.orderId ?? null,
        createdAt: at.toISOString(),
        readAt: null,
        dedupeKey: input.dedupeKey,
        deliveries: [],
      }
      rec.deliveries = channels.map((c) => ({ channel: c.id, status: c.deliver(rec) }))
      rows.push(rec)
      return rec
    },
    list: (storeId, limit = 100) =>
      // Reverse first: for notifications created in the same instant, the later one must still come first.
      [...rows]
        .reverse()
        .filter((n) => n.storeId === storeId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
        .slice(0, limit)
        .map(view),
    unreadCount: (storeId) => rows.filter((n) => n.storeId === storeId && n.readAt === null).length,
    markRead(storeId, id, at) {
      const n = rows.find((x) => x.id === id && x.storeId === storeId)
      if (!n) return false
      n.readAt ??= at.toISOString()
      return true
    },
    markAllRead(storeId, at) {
      let c = 0
      for (const n of rows) if (n.storeId === storeId && n.readAt === null) ((n.readAt = at.toISOString()), c++)
      return c
    },
  }
}
