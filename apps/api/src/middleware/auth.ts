import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { sendError } from '../lib/response.js'
import { validateApiKey } from '../services/apikey.js'
import { ForbiddenError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

export type JwtPayload = { userId: string; email: string }

// Extend Express Request so downstream handlers have typed access.
declare global {
  namespace Express {
    interface Request {
      userId?: string
      userEmail?: string
      authType?: 'jwt' | 'apiKey'
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

function bearerToken(req: Request, res: Response): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    sendError(res, 'Missing Authorization header', 'UNAUTHORIZED', 401)
    return null
  }
  return header.slice(7)
}

function authenticateJwt(token: string, req: Request, res: Response, next: NextFunction): void {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload
    req.userId = payload.userId
    req.userEmail = payload.email
    req.authType = 'jwt'
    next()
  } catch {
    sendError(res, 'Invalid or expired token', 'UNAUTHORIZED', 401)
  }
}

function authenticateApiKey(token: string, req: Request, res: Response, next: NextFunction): void {
  validateApiKey(token)
    .then((userId) => {
      req.userId = userId
      req.authType = 'apiKey'
      next()
    })
    .catch((e: unknown) => {
      if (e instanceof ForbiddenError) {
        sendError(res, 'Invalid or revoked API key', 'UNAUTHORIZED', 401)
        return
      }
      // Not a verdict on the key — the lookup itself failed (e.g. database down). A 401 here
      // would tell the agent its key is revoked; make it retryable instead.
      logger.error('API key validation failed', { error: e instanceof Error ? e.message : String(e) })
      sendError(res, 'Could not verify the API key right now. Retry shortly.', 'AUTH_UNAVAILABLE', 503)
    })
}

/**
 * Requires a valid JWT (issued on login).
 * Used by dashboard routes.
 */
export function requireJwt(req: Request, res: Response, next: NextFunction): void {
  const token = bearerToken(req, res)
  if (token) authenticateJwt(token, req, res, next)
}

/**
 * Requires a valid Argens API key (argns_live_...).
 * Used by agent-facing routes (/pay, /quote, /wallet/balance etc.)
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const token = bearerToken(req, res)
  if (token) authenticateApiKey(token, req, res, next)
}

/**
 * Accepts either a valid JWT (dashboard) OR a valid API key (agent).
 * Used by routes that must be accessible from both the dashboard and agent API.
 */
export function requireJwtOrApiKey(req: Request, res: Response, next: NextFunction): void {
  const token = bearerToken(req, res)
  if (!token) return
  // API keys start with "argns_"; anything else is treated as a JWT.
  if (token.startsWith('argns_')) authenticateApiKey(token, req, res, next)
  else authenticateJwt(token, req, res, next)
}

/**
 * Issues a signed JWT for a user.
 */
export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: (process.env['JWT_EXPIRES_IN'] ?? '1h') as jwt.SignOptions['expiresIn'],
  })
}
