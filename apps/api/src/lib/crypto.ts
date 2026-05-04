import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env['ENCRYPTION_KEY']
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32')
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypts a Stellar secret key with AES-256-GCM.
 * Output format: iv:encrypted:authTag (all hex-encoded, joined by colon).
 * Never store or log the raw secretKey.
 */
export function encryptSecretKey(secretKey: string): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(secretKey, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), encrypted.toString('hex'), tag.toString('hex')].join(':')
}

/**
 * Decrypts a stored encrypted secret key.
 * Wipe the result from memory after use — never assign to a long-lived variable.
 */
export function decryptSecretKey(enc: string): string {
  const key = getKey()
  const parts = enc.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted key format')
  const [ivHex, encHex, tagHex] = parts as [string, string, string]
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * Generates a cryptographically secure random token.
 * Used for email verification and approval queue tokens.
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString('hex')
}
