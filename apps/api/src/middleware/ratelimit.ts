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

// ─── PIN Rate Limiting ──────────────────────────────────────────────────────
// In-memory tracker for transfer PIN attempts (per userId).
// In production, replace with Redis for multi-instance deployments.

interface PinAttempt {
  count: number
  resetAt: number
}

const pinAttemptMap = new Map<string, PinAttempt>()
const PIN_MAX_ATTEMPTS = 5
const PIN_WINDOW_MS = 10 * 60 * 1000 // 10 minutes

export function checkPinAttempt(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = pinAttemptMap.get(userId)

  if (!entry || now > entry.resetAt) {
    // Fresh window
    pinAttemptMap.set(userId, { count: 1, resetAt: now + PIN_WINDOW_MS })
    return { allowed: true, remaining: PIN_MAX_ATTEMPTS - 1 }
  }

  if (entry.count >= PIN_MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: PIN_MAX_ATTEMPTS - entry.count }
}

export function resetPinAttempts(userId: string): void {
  pinAttemptMap.delete(userId)
}
