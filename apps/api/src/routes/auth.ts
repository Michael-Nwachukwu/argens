import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { generateSecureToken } from '../lib/crypto.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { signJwt, requireJwt } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { authLimiter, emailResendLimiter } from '../middleware/ratelimit.js'
import { bootstrapWallet } from '../services/wallet.js'
import { sendVerificationEmail, sendWalletReadyEmail } from '../services/email.js'
import { createApiKey } from '../services/apikey.js'
import { logger } from '../lib/logger.js'
import { AppError } from '../lib/errors.js'

export const authRouter = Router()

// ─── Schemas ───────────────────────────────────────────────────────────────────
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const resendSchema = z.object({
  email: z.string().email(),
})

// ─── POST /auth/signup ─────────────────────────────────────────────────────────
authRouter.post('/signup', authLimiter, validate(signupSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof signupSchema>

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      sendError(res, 'An account with this email already exists.', 'CONFLICT', 409)
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const emailVerificationToken = generateSecureToken()
    const emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    const user = await prisma.user.create({
      data: { email, passwordHash, emailVerificationToken, emailVerificationExpiry },
    })

    // Fire-and-forget — don't block signup response on email delivery.
    sendVerificationEmail(email, emailVerificationToken).catch((e) =>
      logger.error('Failed to send verification email', { userId: user.id, error: (e as Error).message }),
    )

    logger.info('User signed up', { userId: user.id })
    sendSuccess(res, { message: 'Account created. Check your email to verify and activate your wallet.' }, 201)
  } catch (e) {
    logger.error('Signup error', { error: (e as Error).message })
    sendError(res, 'Signup failed. Please try again.', 'INTERNAL_ERROR', 500)
  }
})

// ─── GET /auth/verify/:token ───────────────────────────────────────────────────
authRouter.get('/verify/:token', async (req, res) => {
  const { token } = req.params as { token: string }

  try {
    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
    })

    if (!user) {
      sendError(res, 'Verification token is invalid.', 'INVALID_TOKEN', 400)
      return
    }
    if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
      sendError(res, 'Verification token has expired. Request a new one.', 'TOKEN_EXPIRED', 400)
      return
    }
    if (user.emailVerified) {
      sendError(res, 'Email already verified.', 'ALREADY_VERIFIED', 400)
      return
    }

    // Mark email verified and clear token.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    })

    // Bootstrap wallet — this hits Stellar network so may take a few seconds.
    const { publicKey } = await bootstrapWallet(user.id)

    sendWalletReadyEmail(user.email, publicKey).catch((e) =>
      logger.error('Failed to send wallet ready email', { userId: user.id, error: (e as Error).message }),
    )

    logger.info('Email verified and wallet bootstrapped', { userId: user.id, publicKey })
    sendSuccess(res, {
      message: 'Email verified. Your wallet is ready.',
      wallet_address: publicKey,
    })
  } catch (e) {
    if (e instanceof AppError) {
      sendError(res, e.message, e.code, e.statusCode, e.details)
      return
    }
    logger.error('Verification error', { error: (e as Error).message })
    sendError(res, 'Verification failed. Please try again.', 'INTERNAL_ERROR', 500)
  }
})

// ─── POST /auth/resend-verification ───────────────────────────────────────────
authRouter.post('/resend-verification', emailResendLimiter, validate(resendSchema), async (req, res) => {
  const { email } = req.body as z.infer<typeof resendSchema>

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    // Always return the same response to avoid email enumeration.
    if (!user || user.emailVerified) {
      sendSuccess(res, { message: 'If that email exists and is unverified, a new link has been sent.' })
      return
    }

    const emailVerificationToken = generateSecureToken()
    const emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken, emailVerificationExpiry },
    })

    sendVerificationEmail(email, emailVerificationToken).catch((e) =>
      logger.error('Failed to resend verification email', { userId: user.id, error: (e as Error).message }),
    )

    sendSuccess(res, { message: 'If that email exists and is unverified, a new link has been sent.' })
  } catch (e) {
    logger.error('Resend verification error', { error: (e as Error).message })
    sendError(res, 'Failed to resend verification email.', 'INTERNAL_ERROR', 500)
  }
})

// ─── POST /auth/login ──────────────────────────────────────────────────────────
authRouter.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    // Timing-safe: always run bcrypt even if user not found.
    const passwordHash = user?.passwordHash ?? '$2a$12$invalidhashpadding000000000000000000000000000000000'
    const valid = await bcrypt.compare(password, passwordHash)

    if (!user || !valid) {
      sendError(res, 'Invalid email or password.', 'INVALID_CREDENTIALS', 401)
      return
    }

    const token = signJwt({ userId: user.id, email: user.email })

    logger.info('User logged in', { userId: user.id })
    sendSuccess(res, {
      token,
      email_verified: user.emailVerified,
      message: user.emailVerified
        ? 'Logged in.'
        : 'Logged in. Please verify your email to access agent features.',
    })
  } catch (e) {
    logger.error('Login error', { error: (e as Error).message })
    sendError(res, 'Login failed. Please try again.', 'INTERNAL_ERROR', 500)
  }
})

// ─── POST /auth/logout ─────────────────────────────────────────────────────────
// JWT is stateless — client discards the token. This endpoint is a signal only.
authRouter.post('/logout', requireJwt, (_req, res) => {
  sendSuccess(res, { message: 'Logged out.' })
})

// ─── POST /auth/api-keys ───────────────────────────────────────────────────────
authRouter.post('/api-keys', requireJwt, async (req, res) => {
  try {
    const result = await createApiKey(req.userId!)
    logger.info('API key created', { userId: req.userId })
    sendSuccess(
      res,
      {
        key: result.key,            // Shown ONCE — never retrievable again
        prefix: result.prefix,
        created_at: result.createdAt,
        message: 'Store this key securely. It will not be shown again.',
      },
      201,
    )
  } catch (e) {
    if (e instanceof AppError) {
      sendError(res, e.message, e.code, e.statusCode)
      return
    }
    logger.error('API key creation error', { userId: req.userId, error: (e as Error).message })
    sendError(res, 'Failed to create API key.', 'INTERNAL_ERROR', 500)
  }
})

// ─── GET /auth/me ──────────────────────────────────────────────────────────────
authRouter.get('/me', requireJwt, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { wallet: { select: { stellarPublicKey: true, status: true, balanceCache: true } } },
    })
    if (!user) {
      sendError(res, 'User not found.', 'NOT_FOUND', 404)
      return
    }
    sendSuccess(res, {
      id: user.id,
      email: user.email,
      email_verified: user.emailVerified,
      wallet: user.wallet
        ? { address: user.wallet.stellarPublicKey, status: user.wallet.status }
        : null,
    })
  } catch (e) {
    logger.error('Get me error', { userId: req.userId, error: (e as Error).message })
    sendError(res, 'Failed to fetch user.', 'INTERNAL_ERROR', 500)
  }
})
