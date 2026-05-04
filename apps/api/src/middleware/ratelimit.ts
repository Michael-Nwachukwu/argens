import rateLimit from 'express-rate-limit'
import { sendError } from '../lib/response.js'
import type { Request, Response } from 'express'

const handler = (_req: Request, res: Response): void => {
  sendError(res, 'Too many requests — slow down.', 'RATE_LIMITED', 429)
}

/** General API rate limit: 100 requests per minute per IP */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
})

/** Stricter limit for auth endpoints: 10 requests per minute per IP */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
})

/** Email resend: 3 per hour per IP */
export const emailResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
})
