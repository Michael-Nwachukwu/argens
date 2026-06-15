import { describe, it, expect } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'
import { serializeDecimals } from './response.js'

describe('serializeDecimals', () => {
  it('converts a Decimal to a 7-decimal string', () => {
    expect(serializeDecimals(new Decimal('25'))).toBe('25.0000000')
  })

  it('converts a Date to an ISO string', () => {
    const d = new Date('2026-01-01T00:00:00.000Z')
    expect(serializeDecimals(d)).toBe('2026-01-01T00:00:00.000Z')
  })

  it('passes through strings unchanged', () => {
    expect(serializeDecimals('hello')).toBe('hello')
  })

  it('passes through null unchanged', () => {
    expect(serializeDecimals(null)).toBeNull()
  })

  it('recursively converts Decimals inside objects', () => {
    const result = serializeDecimals({ amount: new Decimal('7.5'), label: 'test' }) as Record<string, unknown>
    expect(result['amount']).toBe('7.5000000')
    expect(result['label']).toBe('test')
  })

  it('recursively converts Decimals inside arrays', () => {
    const result = serializeDecimals([new Decimal('1'), new Decimal('2')]) as string[]
    expect(result).toEqual(['1.0000000', '2.0000000'])
  })

  it('handles nested objects with Decimals and Dates', () => {
    const now = new Date('2026-06-01T00:00:00.000Z')
    const result = serializeDecimals({
      wallet: { balance: new Decimal('492.5'), created_at: now },
    }) as Record<string, Record<string, unknown>>
    expect(result['wallet']['balance']).toBe('492.5000000')
    expect(result['wallet']['created_at']).toBe('2026-06-01T00:00:00.000Z')
  })
})
