import type { UserRole } from '@thulir/shared'

export interface UserRecord {
  id: string
  name: string
  /** Always stored lower-case. */
  email: string
  role: UserRole
  /** bcrypt hash. The password itself is never stored or logged. */
  passwordHash: string
  storeIds: string[]
  status: 'active' | 'disabled'
}

export interface UserRepository {
  byEmail(email: string): UserRecord | undefined
  byId(id: string): UserRecord | undefined
  byRole(role: UserRole): UserRecord[]
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users: UserRecord[]
  constructor(users: UserRecord[]) {
    this.users = users
  }
  byEmail(email: string) {
    const e = email.trim().toLowerCase()
    return this.users.find((u) => u.email === e)
  }
  byId(id: string) {
    return this.users.find((u) => u.id === id)
  }
  byRole(role: UserRole) {
    return this.users.filter((u) => u.role === role && u.status === 'active')
  }
}
