import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { createApi } from './api.js'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/errors.js'
import { LocalDiskStorage, type ImageStorage } from './services/imageStorage.js'

export interface AppOptions {
  /** Injectable clock, so tests can move time (stock expiry, reservation timeouts). */
  clock?: () => Date
  rateLimits?: { orderCreatePerMinute?: number; cartValidatePerMinute?: number; loginPerMinute?: number }
  jwtSecret?: string
  bcryptCost?: number
  secureCookies?: boolean
  images?: ImageStorage
  /** Create a few demo orders at start-up. Off by default so tests start from a clean slate. */
  seedDemo?: boolean
  /** Re-scan stock freshness on this interval (ms). 0 disables it. */
  sweepEveryMs?: number
}

export interface AppHandle extends express.Express {
  /** Stop background timers. */
  stop(): void
  /** Resolves once start-up work (first freshness scan, demo seed) has finished. */
  ready: Promise<void>
}

export function createApp(opts: AppOptions = {}): AppHandle {
  const app = express() as AppHandle
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({ origin: env.corsOrigins, credentials: true }))
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  const api = createApi({
    clock: opts.clock ?? (() => new Date()),
    rateLimits: opts.rateLimits,
    jwtSecret: opts.jwtSecret ?? env.JWT_SECRET,
    bcryptCost: opts.bcryptCost ?? env.BCRYPT_COST,
    secureCookies: opts.secureCookies ?? env.COOKIE_SECURE,
    images: opts.images ?? new LocalDiskStorage(env.UPLOAD_DIR),
    seedDemo: opts.seedDemo,
    runtime: env.DB_DRIVER,
  })

  app.use('/uploads', express.static(env.UPLOAD_DIR, { index: false, dotfiles: 'ignore', setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') }))
  app.use('/api/v1', api.router)
  app.use(notFound)
  app.use(errorHandler)

  app.ready = api.ready

  let timer: NodeJS.Timeout | undefined
  const every = opts.sweepEveryMs ?? 0
  if (every > 0) {
    timer = setInterval(() => void api.sweep().catch((e) => console.error('freshness scan failed', e)), every)
    timer.unref()
  }
  app.stop = () => {
    if (timer) clearInterval(timer)
  }
  return app
}
