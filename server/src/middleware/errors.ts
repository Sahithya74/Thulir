import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'

export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
}

/** Uniform error envelope. Internal details are logged, never returned to the client. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Invalid request', details: err.issues } })
    return
  }
  // Errors raised by the body parsers (oversized upload, malformed JSON) carry their own 4xx status and a stable type.
  const type = (err as { type?: string }).type
  if (type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'That upload is too large.' } })
    return
  }
  if (type === 'entity.parse.failed' || type === 'encoding.unsupported' || type === 'request.aborted') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'The request body could not be read.' } })
    return
  }
  console.error('Unhandled error', err)
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } })
}
