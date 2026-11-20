import { randomBytes } from 'node:crypto'
import type { UserRole } from '@thulir/shared'

export interface AuditRecord {
  id: string
  at: string
  actorId: string
  actorName: string
  actorRole: UserRole | 'system'
  /** Null for events that belong to no store (e.g. sign-ins). */
  storeId: string | null
  action: string
  entityType: string
  entityId: string
  summary: string
  reason: string | null
  before: unknown
  after: unknown
}

export type AuditInput = Omit<AuditRecord, 'id' | 'at'>

/**
 * Append-only by construction: this interface has no update and no delete. Whatever calls `append` cannot later
 * rewrite history, and stored `before` / `after` are deep-copied so later mutation of live objects cannot alter them.
 */
export interface AuditLog {
  append(entry: AuditInput, at: Date): AuditRecord
  listByStore(storeId: string, limit?: number): AuditRecord[]
  all(): readonly AuditRecord[]
}

export class InMemoryAuditLog implements AuditLog {
  private readonly rows: AuditRecord[] = []

  append(entry: AuditInput, at: Date): AuditRecord {
    const rec: AuditRecord = {
      ...entry,
      id: `AUD-${randomBytes(5).toString('hex').toUpperCase()}`,
      at: at.toISOString(),
      before: entry.before === undefined ? null : structuredClone(entry.before),
      after: entry.after === undefined ? null : structuredClone(entry.after),
    }
    this.rows.push(Object.freeze(rec))
    return rec
  }

  listByStore(storeId: string, limit = 100) {
    const out: AuditRecord[] = []
    for (let i = this.rows.length - 1; i >= 0 && out.length < limit; i--) if (this.rows[i].storeId === storeId) out.push(this.rows[i])
    return out
  }

  all() {
    return this.rows
  }
}
