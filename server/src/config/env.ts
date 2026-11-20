import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'

const bool = z.enum(['true', 'false']).transform((v) => v === 'true')

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGINS: z.string().default('http://localhost:5180,http://127.0.0.1:5180'),
  DB_DRIVER: z.enum(['memory']).default('memory'),
  /** Signs session tokens. Required (32+ chars) in production; a random one is generated per boot in development. */
  JWT_SECRET: z.string().min(32).optional(),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  /** Send the session cookie over HTTPS only. Must be true in production. */
  COOKIE_SECURE: bool.optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
  SWEEP_INTERVAL_MIN: z.coerce.number().int().min(1).max(1440).default(10),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment configuration:', z.prettifyError(parsed.error))
  process.exit(1)
}

const production = parsed.data.NODE_ENV === 'production'
if (production && !parsed.data.JWT_SECRET) {
  console.error('JWT_SECRET (32+ characters) is required in production.')
  process.exit(1)
}
if (production && parsed.data.COOKIE_SECURE === false) {
  console.error('COOKIE_SECURE must not be false in production.')
  process.exit(1)
}
if (!parsed.data.JWT_SECRET) {
  console.warn('JWT_SECRET is not set: using a random secret for this run. Sessions will not survive a restart.')
}

export const env = {
  ...parsed.data,
  JWT_SECRET: parsed.data.JWT_SECRET ?? randomBytes(32).toString('hex'),
  COOKIE_SECURE: parsed.data.COOKIE_SECURE ?? production,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
}
