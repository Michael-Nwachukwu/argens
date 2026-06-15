import { describe, it, expect } from 'vitest'
import { isStellarAddress, isEvmAddress, validateMemo } from './stellar.js'

// Mainnet USDC issuer — a real, verified 56-char G address
const USDC_ISSUER   = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
// Testnet USDC issuer — another real 56-char G address
const USDC_TESTNET  = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

describe('isStellarAddress', () => {
  it('returns true for a valid 56-char G address', () => {
    expect(isStellarAddress(USDC_ISSUER)).toBe(true)
    expect(isStellarAddress(USDC_TESTNET)).toBe(true)
  })

  it('returns false for an EVM address', () => {
    expect(isStellarAddress('0x' + 'ab'.repeat(20))).toBe(false)
  })

  it('returns false for a short string', () => {
    expect(isStellarAddress('GABC')).toBe(false)
  })

  it('returns false for a 56-char string not starting with G', () => {
    expect(isStellarAddress('S' + 'A'.repeat(55))).toBe(false)
  })
})

describe('isEvmAddress', () => {
  it('returns true for a valid 42-char 0x address', () => {
    expect(isEvmAddress('0x' + 'ab'.repeat(20))).toBe(true)
  })

  it('returns false for a Stellar address', () => {
    expect(isEvmAddress(USDC_ISSUER)).toBe(false)
  })

  it('returns false for a short 0x string', () => {
    expect(isEvmAddress('0xabc')).toBe(false)
  })

  it('returns false for an address without 0x prefix', () => {
    expect(isEvmAddress('ab'.repeat(20))).toBe(false)
  })
})

describe('validateMemo', () => {
  it('accepts a memo within 28 bytes', () => {
    expect(() => validateMemo('hello')).not.toThrow()
  })

  it('accepts exactly 28 ASCII bytes', () => {
    expect(() => validateMemo('A'.repeat(28))).not.toThrow()
  })

  it('throws on a 29-byte ASCII string', () => {
    expect(() => validateMemo('A'.repeat(29))).toThrow()
  })

  it('throws on a multi-byte UTF-8 string that exceeds 28 bytes', () => {
    // '€' is 3 bytes in UTF-8 — 10 of them = 30 bytes
    expect(() => validateMemo('€'.repeat(10))).toThrow()
  })

  it('accepts a multi-byte UTF-8 string within 28 bytes', () => {
    // '€' is 3 bytes — 9 of them = 27 bytes
    expect(() => validateMemo('€'.repeat(9))).not.toThrow()
  })
})
