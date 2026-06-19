import { type Router } from 'express'
import { Router as ExpressRouter } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { generateSecureToken } from '../lib/crypto.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { signJwt, requireJwt } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { authLimiter, emailResendLimiter, resetPinAttempts } from '../middleware/ratelimit.js'
import { bootstrapWallet } from '../services/wallet.js'
import { sendVerificationEmail, sendWalletReadyEmail, sendPasswordResetEmail } from '../services/email.js'
import { createApiKey } from '../services/apikey.js'
import { assertDeliverableEmail, EmailRejectedError } from '../services/email-validation.js'
import { logger } from '../lib/logger.js'
import { AppError } from '../lib/errors.js'

export const authRouter: Router = ExpressRouter()

// ─── Schemas ───────────────────────────────────────────────────────────────────
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  accessCode: z.string().min(1, 'Access code is required during beta'),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const resendSchema = z.object({
  email: z.string().email(),
})

const pinSetSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
  password: z.string().min(1, 'Password is required'),
})

const pinRemoveSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

// ─── POST /auth/signup ─────────────────────────────────────────────────────────
authRouter.post('/signup', authLimiter, validate(signupSchema), async (req, res) => {
  const { email, password, accessCode } = req.body as z.infer<typeof signupSchema>

  try {
    // Only valid, deliverable, non-disposable emails get an account.
    try {
      await assertDeliverableEmail(email)
    } catch (e) {
      if (e instanceof EmailRejectedError) {
        sendError(res, e.message, e.code, e.statusCode)
        return
      }
      throw e
    }

    // Validate the beta access code BEFORE checking for existing email or hashing password.
    const code = await prisma.accessCode.findUnique({ where: { code: accessCode } })
    if (!code) {
      sendError(res, 'Access code is invalid.', 'ACCESS_CODE_INVALID', 422)
      return
    }
    if (code.redeemedBy) {
      sendError(res, 'This access code has already been used.', 'ACCESS_CODE_ALREADY_REDEEMED', 422)
      return
    }
    if (code.expiresAt && code.expiresAt < new Date()) {
      sendError(res, 'This access code has expired.', 'ACCESS_CODE_EXPIRED', 422)
      return
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      sendError(res, 'An account with this email already exists.', 'CONFLICT', 409)
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const emailVerificationToken = generateSecureToken()
    const emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h

    // Atomic: create user + redeem code + flip matching waitlist row + audit log
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, passwordHash, emailVerificationToken, emailVerificationExpiry, accessCodeId: code.id },
      })
      // Mark the code redeemed. Use the unique constraint on redeemedBy + the previous
      // null check above as a soft race guard. If two requests race for the same code,
      // the unique constraint on redeemedBy will reject the second.
      await tx.accessCode.update({
        where: { id: code.id },
        data: { redeemedBy: u.id, redeemedAt: new Date() },
      })
      await tx.auditLog.create({
        data: {
          userId: u.id,
          eventType: 'ACCESS_CODE_REDEEMED',
          eventData: { code: code.code, codeId: code.id, note: code.note ?? null },
        },
      })
      return u
    })

    // Fire-and-forget — don't block signup response on email delivery.
    sendVerificationEmail(email, emailVerificationToken).catch((e) =>
      logger.error('Failed to send verification email', { userId: user.id, error: (e as Error).message }),
    )

    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'

    logger.info('User signed up', { userId: user.id, accessCodeId: code.id })
    if (process.env['NODE_ENV'] !== 'production') {
      logger.info('Dev verification URL', { userId: user.id, url: `${frontendUrl}/auth/verify?token=${emailVerificationToken}` })
    }
    sendSuccess(res, {
      message: 'Account created. Check your email to verify and activate your wallet.',
    }, 201)
  } catch (e) {
    // Unique constraint race on AccessCode.redeemedBy → code was taken between check and update
    const msg = (e as { code?: string }).code
    if (msg === 'P2002') {
      logger.warn('Access code race detected on signup', { error: (e as Error).message })
      sendError(res, 'This access code has already been used.', 'ACCESS_CODE_ALREADY_REDEEMED', 422)
      return
    }
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
    const apiKey = await createApiKey(user.id)

    sendWalletReadyEmail(user.email, publicKey).catch((e) =>
      logger.error('Failed to send wallet ready email', { userId: user.id, error: (e as Error).message }),
    )

    logger.info('Email verified and wallet bootstrapped', { userId: user.id, publicKey })
    sendSuccess(res, {
      message: 'Email verified. Your wallet is ready.',
      wallet_address: publicKey,
      api_key: apiKey.key,
      api_key_prefix: apiKey.prefix,
      api_key_message: 'Store this API key securely. It will not be shown again.',
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
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        transferPinSet: !!user.transferPinHash,
      },
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

// ─── POST /auth/forgot-password ──────────────────────────────────────────────────
// Generates a single-use, 1h reset token and emails the reset link.
// Always returns the same response regardless of whether the email exists (no enumeration).
authRouter.post('/forgot-password', emailResendLimiter, validate(forgotPasswordSchema), async (req, res) => {
  const { email } = req.body as z.infer<typeof forgotPasswordSchema>

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    if (user) {
      const passwordResetToken = generateSecureToken()
      const passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken, passwordResetExpiry },
      })

      sendPasswordResetEmail(email, passwordResetToken).catch((e) =>
        logger.error('Failed to send password reset email', { userId: user.id, error: (e as Error).message }),
      )
    }

    sendSuccess(res, { message: 'If that email is registered, a password reset link has been sent.' })
  } catch (e) {
    logger.error('Forgot password error', { error: (e as Error).message })
    sendError(res, 'Failed to process request. Please try again.', 'INTERNAL_ERROR', 500)
  }
})

// ─── POST /auth/reset-password ───────────────────────────────────────────────────
// Validates the single-use token + expiry, sets the new password, clears the token.
authRouter.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req, res) => {
  const { token, password } = req.body as z.infer<typeof resetPasswordSchema>

  try {
    const user = await prisma.user.findUnique({ where: { passwordResetToken: token } })

    if (!user || !user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      sendError(res, 'This password reset link is invalid or has expired.', 'INVALID_TOKEN', 400)
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpiry: null },
    })

    logger.info('Password reset completed', { userId: user.id })
    sendSuccess(res, { message: 'Password updated. You can now log in with your new password.' })
  } catch (e) {
    logger.error('Reset password error', { error: (e as Error).message })
    sendError(res, 'Failed to reset password. Please try again.', 'INTERNAL_ERROR', 500)
  }
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
      transfer_pin_set: !!user.transferPinHash,
      wallet: user.wallet
        ? { address: user.wallet.stellarPublicKey, status: user.wallet.status }
        : null,
    })
  } catch (e) {
    logger.error('Get me error', { userId: req.userId, error: (e as Error).message })
    sendError(res, 'Failed to fetch user.', 'INTERNAL_ERROR', 500)
  }
})

// ─── POST /auth/transfer-pin ───────────────────────────────────────────────────
authRouter.post('/transfer-pin', requireJwt, validate(pinSetSchema), async (req, res) => {
  const userId = req.userId!
  const { pin, password } = req.body as z.infer<typeof pinSetSchema>

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      sendError(res, 'User not found.', 'NOT_FOUND', 404)
      return
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      sendError(res, 'Incorrect password.', 'INVALID_CREDENTIALS', 401)
      return
    }

    const pinHash = await bcrypt.hash(pin, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { transferPinHash: pinHash },
    })

    logger.info('Transfer PIN set', { userId })
    sendSuccess(res, { message: 'Transfer PIN set successfully.' })
  } catch (e) {
    logger.error('Set transfer PIN error', { userId, error: (e as Error).message })
    sendError(res, 'Failed to set transfer PIN.', 'INTERNAL_ERROR', 500)
  }
})

// ─── DELETE /auth/transfer-pin ──────────────────────────────────────────────────
authRouter.delete('/transfer-pin', requireJwt, validate(pinRemoveSchema), async (req, res) => {
  const userId = req.userId!
  const { password } = req.body as z.infer<typeof pinRemoveSchema>

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      sendError(res, 'User not found.', 'NOT_FOUND', 404)
      return
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      sendError(res, 'Incorrect password.', 'INVALID_CREDENTIALS', 401)
      return
    }

    await prisma.user.update({
      where: { id: userId },
      data: { transferPinHash: null },
    })

    logger.info('Transfer PIN removed', { userId })
    sendSuccess(res, { message: 'Transfer PIN removed.' })
  } catch (e) {
    logger.error('Remove transfer PIN error', { userId, error: (e as Error).message })
    sendError(res, 'Failed to remove transfer PIN.', 'INTERNAL_ERROR', 500)
  }
})
