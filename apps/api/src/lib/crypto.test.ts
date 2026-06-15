import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'

// Set ENCRYPTION_KEY before the module loads
const TEST_KEY = randomBytes(32).toString('hex')
beforeAll(() => {
  process.env['ENCRYPTION_KEY'] = TEST_KEY
})

const { encryptSecretKey, decryptSecretKey, generateSecureToken } = await import('./crypto.js')

describe('encryptSecretKey / decryptSecretKey', () => {
  it('round-trips a Stellar secret key', () => {
    const secret = 'SCZANGBA5JTLCJ5RONTZBPJZAAXV7KFZM6QNTZXCQJQCQZXCQJKQNTZ'
    const enc = encryptSecretKey(secret)
    expect(decryptSecretKey(enc)).toBe(secret)
  })

  it('encrypted output has three colon-separated hex parts', () => {
    const enc = encryptSecretKey('SABC')
    const parts = enc.split(':')
    expect(parts).toHaveLength(3)
    for (const p of parts) {
      expect(/^[0-9a-f]+$/i.test(p)).toBe(true)
    }
  })

  it('tampered ciphertext throws on decryption', () => {
    const enc = encryptSecretKey('SABC')
    const [iv, cipher, tag] = enc.split(':') as [string, string, string]
    // Flip first byte of ciphertext
    const tampered = cipher.slice(0, -2) + ((parseInt(cipher.slice(-2), 16) ^ 1).toString(16).padStart(2, '0'))
    expect(() => decryptSecretKey(`${iv}:${tampered}:${tag}`)).toThrow()
  })
})

describe('generateSecureToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateSecureToken()
    expect(token).toHaveLength(64)
    expect(/^[0-9a-f]+$/.test(token)).toBe(true)
  })

  it('two calls return different tokens', () => {
    expect(generateSecureToken()).not.toBe(generateSecureToken())
  })
})
