import { describe, it, expect, vi, beforeAll } from 'vitest'

// Set required env vars before the module loads
beforeAll(() => {
  vi.stubEnv('STELLAR_NETWORK', 'testnet')
  vi.stubEnv('SOROBAN_RPC_URL', 'https://soroban-testnet.stellar.org')
})

import { computeCctpFee, encodeEvmRecipient } from './cctp.js'

describe('computeCctpFee', () => {
  it('applies 0.5% rate for a mid-range amount', () => {
    expect(computeCctpFee('25.0000000')).toBe('0.1250000')
  })

  it('clamps to minimum ($0.01) for a tiny amount', () => {
    expect(computeCctpFee('1.0000000')).toBe('0.0100000')
  })

  it('applies the 0.5% rate above the $0.01 floor', () => {
    // $5 × 0.005 = $0.025, above the floor — rate applies, not the minimum.
    expect(computeCctpFee('5.0000000')).toBe('0.0250000')
  })

  it('clamps to maximum ($2.00) for a large amount', () => {
    expect(computeCctpFee('1000.0000000')).toBe('2.0000000')
  })

  it('result is always a 7-decimal string', () => {
    const fee = computeCctpFee('100.0000000')
    expect(/^\d+\.\d{7}$/.test(fee)).toBe(true)
  })
})

describe('encodeEvmRecipient', () => {
  it('pads a 20-byte EVM address to 32 bytes with 12 leading zero bytes', () => {
    const addr = '0x' + '11'.repeat(20)
    const buf = encodeEvmRecipient(addr)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBe(32)
    // First 12 bytes must be zero
    for (let i = 0; i < 12; i++) {
      expect(buf[i]).toBe(0)
    }
    // Last 20 bytes must be 0x11
    for (let i = 12; i < 32; i++) {
      expect(buf[i]).toBe(0x11)
    }
  })
})
