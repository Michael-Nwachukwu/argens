import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { sendError } from '../lib/response.js'
import { validateApiKey } from '../services/apikey.js'

export type JwtPayload = { userId: string; email: string }

// Extend Express Request so downstream handlers have typed access.
declare global {
  namespace Express {
    interface Request {
      userId?: string
      userEmail?: string
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET']
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters')
  }
  return secret
}

/**
 * Requires a valid JWT (issued on login).
 * Used by dashboard routes.
 */
export function requireJwt(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    sendError(res, 'Missing Authorization header', 'UNAUTHORIZED', 401)
    return
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload
    req.userId = payload.userId
    req.userEmail = payload.email
    next()
  } catch {
    sendError(res, 'Invalid or expired token', 'UNAUTHORIZED', 401)
  }
}

/**
 * Requires a valid Argens API key (argns_live_...).
 * Used by agent-facing routes (/pay, /quote, /wallet/balance etc.)
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    sendError(res, 'Missing Authorization header', 'UNAUTHORIZED', 401)
    return
  }
  const key = header.slice(7)
  validateApiKey(key)
    .then((userId) => {
      req.userId = userId
      next()
    })
    .catch(() => {
      sendError(res, 'Invalid or revoked API key', 'UNAUTHORIZED', 401)
    })
}

/**
 * Accepts either a valid JWT (dashboard) OR a valid API key (agent).
 * Used by routes that must be accessible from both the dashboard and agent API.
 */
export function requireJwtOrApiKey(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    sendError(res, 'Missing Authorization header', 'UNAUTHORIZED', 401)
    return
  }
  const token = header.slice(7)

  // API keys start with "argns_" — try API key path first
  if (token.startsWith('argns_')) {
    validateApiKey(token)
      .then((userId) => {
        req.userId = userId
        next()
      })
      .catch(() => {
        sendError(res, 'Invalid or revoked API key', 'UNAUTHORIZED', 401)
      })
    return
  }

  // Otherwise try JWT
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload
    req.userId = payload.userId
    req.userEmail = payload.email
    next()
  } catch {
    sendError(res, 'Invalid or expired token', 'UNAUTHORIZED', 401)
  }
}

/**
 * Issues a signed JWT for a user.
 */
export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: (process.env['JWT_EXPIRES_IN'] ?? '1h') as jwt.SignOptions['expiresIn'],
  })
}
