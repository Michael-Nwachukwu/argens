import { describe, it, expect } from 'vitest'
import { DecimalAmountSchema, PositiveAmountSchema } from './money.js'

describe('DecimalAmountSchema', () => {
  it('accepts up to 11 integer digits and 7 decimals', () => {
    expect(DecimalAmountSchema.safeParse('99999999999.9999999').success).toBe(true)
    expect(DecimalAmountSchema.safeParse('0').success).toBe(true)
  })

  it('rejects values that do not fit Decimal(18, 7)', () => {
    expect(DecimalAmountSchema.safeParse('100000000000').success).toBe(false)
    expect(DecimalAmountSchema.safeParse('1.12345678').success).toBe(false)
  })

  it('rejects non-decimal strings', () => {
    for (const v of ['', '-1', '1e3', '1.', '.5', ' 1']) expect(DecimalAmountSchema.safeParse(v).success).toBe(false)
  })
})

describe('PositiveAmountSchema', () => {
  it('rejects zero and accepts the smallest unit', () => {
    expect(PositiveAmountSchema.safeParse('0.0000000').success).toBe(false)
    expect(PositiveAmountSchema.safeParse('0.0000001').success).toBe(true)
  })
})
