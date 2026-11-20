import bcrypt from 'bcryptjs'
import type { UserRecord } from './users.repository.js'

/**
 * DEMO ACCOUNTS. These exist so the prototype can be tried; the password is published on the demo login page on
 * purpose. A real deployment has no seeded accounts and enforces its own password rules.
 */
export const DEMO_PASSWORD = 'Thulir-Demo-2026!'

const owners: { id: string; storeId: string; name: string; email: string }[] = [
  { id: 'u-owner-marutham', storeId: 'store-marutham', name: 'Demo owner · Marutham Super Mart', email: 'owner.marutham@demo.thulir.test' },
  { id: 'u-owner-selvam', storeId: 'store-selvam', name: 'Demo owner · Selvam Provision Stores', email: 'owner.selvam@demo.thulir.test' },
  { id: 'u-owner-pasumai', storeId: 'store-pasumai', name: 'Demo owner · Pasumai Fruits & Vegetables', email: 'owner.pasumai@demo.thulir.test' },
  { id: 'u-owner-madhuram', storeId: 'store-madhuram', name: 'Demo owner · Madhuram Bakery', email: 'owner.madhuram@demo.thulir.test' },
  { id: 'u-owner-thenral', storeId: 'store-thenral', name: 'Demo owner · Thenral Dairy', email: 'owner.thenral@demo.thulir.test' },
  { id: 'u-owner-illam', storeId: 'store-illam', name: 'Demo owner · Illam Household Needs', email: 'owner.illam@demo.thulir.test' },
]

export const DEMO_OWNER_LOGINS = owners.map((o) => ({ email: o.email, storeId: o.storeId, name: o.name }))

export function buildDemoUsers(bcryptCost: number): UserRecord[] {
  // One hash shared by every demo account keeps start-up fast at a production-grade cost factor.
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, bcryptCost)
  return [
    ...owners.map((o): UserRecord => ({ id: o.id, name: o.name, email: o.email, role: 'store_owner', passwordHash, storeIds: [o.storeId], status: 'active' })),
    { id: 'u-admin', name: 'Demo platform admin', email: 'admin@demo.thulir.test', role: 'admin', passwordHash, storeIds: [], status: 'active' },
    { id: 'u-partner', name: 'Ravi Kumar (demo partner)', email: 'partner@demo.thulir.test', role: 'delivery_partner', passwordHash, storeIds: [], status: 'active' },
    { id: 'u-customer', name: 'Demo customer', email: 'customer@demo.thulir.test', role: 'customer', passwordHash, storeIds: [], status: 'active' },
  ]
}
