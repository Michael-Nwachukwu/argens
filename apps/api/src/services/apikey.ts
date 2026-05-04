import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { ForbiddenError, NotFoundError } from '../lib/errors.js'

const BCRYPT_ROUNDS = 10

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString('hex')
  const key = `argns_live_${raw}`
  // Store enough of the key for the user to identify it in the UI (e.g. "argns_live_ab12ef...")
  const prefix = key.substring(0, 20)
  const hash = bcrypt.hashSync(key, BCRYPT_ROUNDS)
  return { key, hash, prefix }
}

/**
 * Creates a new API key for a verified user.
 * Returns the plaintext key exactly once — it is never retrievable again.
 */
export async function createApiKey(userId: string): Promise<{ key: string; prefix: string; createdAt: Date }> {
  // Gate: only verified users can generate API keys.
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new NotFoundError('User')
  if (!user.emailVerified) {
    throw new ForbiddenError('Email must be verified before generating an API key.')
  }

  const { key, hash, prefix } = generateApiKey()

  const apiKey = await prisma.apiKey.create({
    data: { userId, keyHash: hash, keyPrefix: prefix },
  })

  return { key, prefix, createdAt: apiKey.createdAt }
}

/**
 * Validates an API key from an Authorization header.
 * Returns the userId if valid, throws UnauthorizedError if not.
 */
export async function validateApiKey(rawKey: string): Promise<string> {
  if (!rawKey.startsWith('argns_live_')) {
    throw new ForbiddenError('Invalid API key format')
  }

  // Find candidate keys by prefix (fast) then bcrypt-verify (slow but necessary).
  const prefix = rawKey.substring(0, 20)
  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix: prefix, isActive: true },
  })

  for (const candidate of candidates) {
    const valid = await bcrypt.compare(rawKey, candidate.keyHash)
    if (valid) {
      // Update lastUsedAt without blocking the request.
      prisma.apiKey
        .update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined)
      return candidate.userId
    }
  }

  throw new ForbiddenError('Invalid or revoked API key')
}
