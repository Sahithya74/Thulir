import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import pkg from 'node-sql-parser'
import { STORE_ORDER_TRANSITIONS } from '@thulir/shared'

/**
 * Static checks on schema.sql. There is no MySQL server in this environment, so this does NOT prove the schema runs —
 * it proves it parses as MySQL and is internally consistent (keys, references, types), which catches most mistakes.
 */
const { Parser } = pkg as unknown as { Parser: new () => { astify(sql: string, opt: { database: string }): unknown } }
const raw = readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8')
const statements = raw
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean)

interface ColRef {
  column: string
}
interface Def {
  resource: 'column' | 'constraint' | 'index'
  column?: ColRef
  definition?: ({ dataType?: string; length?: number } & Record<string, unknown>) | ColRef[]
  constraint_type?: string
  reference_definition?: { table: { table: string }[]; definition: ColRef[] }
}
interface Table {
  name: string
  columns: Map<string, string>
  pk: string[]
  uniques: string[][]
  defs: Def[]
}

const parser = new Parser()
const tables = new Map<string, Table>()
const parseErrors: string[] = []
for (const sql of statements) {
  try {
    const ast = parser.astify(`${sql};`, { database: 'MySQL' })
    const t = (Array.isArray(ast) ? ast[0] : ast) as { table: { table: string }[]; create_definitions: Def[] }
    const name = t.table[0].table
    const columns = new Map<string, string>()
    const uniques: string[][] = []
    let pk: string[] = []
    for (const d of t.create_definitions) {
      if (d.resource === 'column' && d.column) {
        const def = d.definition as { dataType?: string; length?: number }
        columns.set(d.column.column, `${def.dataType}${def.length !== undefined ? `(${def.length})` : ''}`.toUpperCase())
      }
      if (d.resource === 'constraint' && d.constraint_type?.toLowerCase() === 'primary key') pk = (d.definition as ColRef[]).map((c) => c.column)
      if (d.resource === 'constraint' && d.constraint_type?.toLowerCase() === 'unique key') uniques.push((d.definition as ColRef[]).map((c) => c.column))
    }
    tables.set(name, { name, columns, pk, uniques, defs: t.create_definitions })
  } catch (e) {
    parseErrors.push(`${sql.slice(0, 60)}… → ${(e as Error).message.slice(0, 160)}`)
  }
}

describe('schema.sql (static checks)', () => {
  it('every statement parses as MySQL', () => {
    expect(parseErrors).toEqual([])
    expect(tables.size).toBe(statements.length)
  })

  it('has the tables the platform needs', () => {
    for (const t of [
      'users', 'customer_profiles', 'addresses', 'stores', 'store_owners', 'store_verifications', 'categories', 'products',
      'product_batches', 'inventory_movements', 'expiry_policies', 'product_eligibility_cache', 'carts', 'cart_items', 'orders',
      'store_orders', 'order_items', 'order_item_allocations', 'store_order_status_history', 'payments', 'payment_attempts',
      'delivery_partners', 'delivery_assignments', 'reviews', 'notifications', 'notification_deliveries', 'offers', 'audit_logs',
      'admin_settings', 'towns', 'areas', 'delivery_zones',
    ]) {
      expect(tables.has(t), t).toBe(true)
    }
  })

  it('every table has a primary key made of its own columns', () => {
    for (const t of tables.values()) {
      expect(t.pk.length, t.name).toBeGreaterThan(0)
      for (const c of t.pk) expect(t.columns.has(c), `${t.name}.${c}`).toBe(true)
    }
  })

  it('every index and unique key names real columns', () => {
    for (const t of tables.values()) {
      for (const d of t.defs) {
        if ((d.resource === 'index' || (d.resource === 'constraint' && d.constraint_type?.toLowerCase() === 'unique key')) && Array.isArray(d.definition)) {
          for (const c of d.definition) expect(t.columns.has(c.column), `${t.name} index → ${c.column}`).toBe(true)
        }
      }
    }
  })

  it('every foreign key points at an existing table, at a key of that table, with the same column type', () => {
    let count = 0
    for (const t of tables.values()) {
      for (const d of t.defs) {
        if (d.resource !== 'constraint' || d.constraint_type?.toUpperCase() !== 'FOREIGN KEY') continue
        count++
        const from = (d.definition as ColRef[]).map((c) => c.column)
        const target = tables.get(d.reference_definition!.table[0].table)
        expect(target, `${t.name} → ${d.reference_definition!.table[0].table}`).toBeDefined()
        const to = d.reference_definition!.definition.map((c) => c.column)
        const isKey = JSON.stringify(target!.pk) === JSON.stringify(to) || target!.uniques.some((u) => JSON.stringify(u) === JSON.stringify(to))
        expect(isKey, `${t.name}(${from}) → ${target!.name}(${to}) must reference a key`).toBe(true)
        from.forEach((col, i) => {
          expect(t.columns.has(col), `${t.name}.${col}`).toBe(true)
          expect(t.columns.get(col), `${t.name}.${col} vs ${target!.name}.${to[i]}`).toBe(target!.columns.get(to[i]))
        })
      }
    }
    expect(count).toBeGreaterThan(40)
  })

  it('money is integer paise, never floating point', () => {
    for (const t of tables.values()) {
      for (const [c, type] of t.columns) {
        if (c.endsWith('_paise')) expect(type, `${t.name}.${c}`).toBe('BIGINT')
        expect(/FLOAT|DOUBLE/.test(type), `${t.name}.${c}`).toBe(false)
      }
    }
  })

  it('expiry lives on batches, not on products', () => {
    expect(tables.get('products')!.columns.has('expiry_date')).toBe(false)
    expect(tables.get('product_batches')!.columns.has('expiry_date')).toBe(true)
  })

  it('store order statuses match the shared state machine exactly', () => {
    const m = raw.match(/CREATE TABLE store_orders[\s\S]*?\n\s*status\s+ENUM\(([^)]+)\)/)
    const values = m![1].split(',').map((v) => v.trim().replace(/'/g, ''))
    expect(values.sort()).toEqual(Object.keys(STORE_ORDER_TRANSITIONS).sort())
  })
})
