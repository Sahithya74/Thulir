import { Router, type CookieOptions } from 'express'
import { z } from 'zod'
import { AppError } from '../../middleware/errors.js'
import { authenticate, requireCsrf } from '../../middleware/auth.js'
import { rateLimit } from '../../middleware/rateLimit.js'
import type { AuditLog } from '../audit/audit.repository.js'
import { CSRF_COOKIE, SESSION_COOKIE, SESSION_HOURS, toSessionUser, type AuthService } from './auth.service.js'

const body = z.object({ email: z.string().trim().min(3).max(120), password: z.string().min(1).max(200) }).strict()

interface Opts {
  secureCookies: boolean
  loginPerMinute: number
  audit: AuditLog
  clock: () => Date
}

export function authRoutes(auth: AuthService, { secureCookies, loginPerMinute, audit, clock }: Opts): Router {
  const r = Router()
  const base: CookieOptions = { sameSite: 'lax', secure: secureCookies, maxAge: SESSION_HOURS * 3_600_000 }

  r.post(
    '/login',
    // Throttle per client AND per email, so neither one account nor one machine can be hammered.
    rateLimit({ windowMs: 60_000, max: loginPerMinute, key: (req) => `${req.ip}|${String((req.body as { email?: unknown })?.email ?? '').toLowerCase()}` }),
    async (req, res) => {
      const parsed = body.safeParse(req.body)
      if (!parsed.success) throw new AppError(400, 'VALIDATION_FAILED', 'Enter your email and password.')
      try {
        const { user, token, csrf } = await auth.login(parsed.data.email, parsed.data.password)
        // httpOnly: scripts cannot read the session. path /api: it is only ever sent to the API.
        res.cookie(SESSION_COOKIE, token, { ...base, httpOnly: true, path: '/api' })
        // Readable on purpose: the page echoes it in a header (double-submit CSRF).
        res.cookie(CSRF_COOKIE, csrf, { ...base, httpOnly: false, path: '/' })
        audit.append({ actorId: user.id, actorName: user.name, actorRole: user.role, storeId: null, action: 'auth.login', entityType: 'user', entityId: user.id, summary: 'Signed in', reason: null, before: null, after: null }, clock())
        res.json({ data: toSessionUser(user) })
      } catch (e) {
        if (e instanceof AppError && e.code === 'INVALID_CREDENTIALS') {
          // Failed attempts are recorded without storing what was typed as a password.
          audit.append({ actorId: 'anonymous', actorName: 'Anonymous', actorRole: 'system', storeId: null, action: 'auth.login_failed', entityType: 'user', entityId: 'unknown', summary: 'Failed sign-in attempt', reason: null, before: null, after: null }, clock())
        }
        throw e
      }
    },
  )

  r.get('/me', authenticate(auth), (_req, res) => {
    res.json({ data: res.locals.user })
  })

  r.post('/logout', requireCsrf, (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { ...base, httpOnly: true, path: '/api' })
    res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false, path: '/' })
    res.json({ data: { ok: true } })
  })

  return r
}
