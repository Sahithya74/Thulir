import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { SessionUser } from '@thulir/shared'
import { AppError } from '../../middleware/errors.js'
import type { UserRecord, UserRepository } from './users.repository.js'

export const SESSION_COOKIE = 'thulir_session'
export const CSRF_COOKIE = 'thulir_csrf'
export const SESSION_HOURS = 8

export const toSessionUser = (u: UserRecord): SessionUser => ({ id: u.id, name: u.name, email: u.email, role: u.role, storeIds: [...u.storeIds] })

export interface AuthService {
  /** Same error for "no such user" and "wrong password", and the same amount of work for both. */
  login(email: string, password: string): Promise<{ user: UserRecord; token: string; csrf: string }>
  /** Resolve a session token to a current, active user — or null. Looked up fresh on every request. */
  verify(token: string | undefined): UserRecord | null
}

export function createAuthService(users: UserRepository, jwtSecret: string, bcryptCost: number): AuthService {
  // A hash to compare against when the email is unknown, so timing does not reveal which emails exist.
  const dummy = bcrypt.hashSync(randomBytes(16).toString('hex'), bcryptCost)

  return {
    async login(email, password) {
      const user = users.byEmail(email)
      const ok = await bcrypt.compare(password, user?.passwordHash ?? dummy)
      if (!user || !ok || user.status !== 'active') {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')
      }
      // The token carries only who the user is. Roles and store access are read fresh from the repository on each request.
      const token = jwt.sign({ sub: user.id }, jwtSecret, { algorithm: 'HS256', expiresIn: `${SESSION_HOURS}h` })
      return { user, token, csrf: randomBytes(24).toString('base64url') }
    },

    verify(token) {
      if (!token) return null
      try {
        // algorithms is pinned: a token claiming "alg: none" or another algorithm is rejected.
        const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as { sub?: string }
        const user = payload.sub ? users.byId(payload.sub) : undefined
        return user && user.status === 'active' ? user : null
      } catch {
        return null
      }
    },
  }
}
