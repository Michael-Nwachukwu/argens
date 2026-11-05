import { describe, it, expect } from 'vitest'
import { emailMatches } from './user.js'

describe('emailMatches', () => {
  it('matches case-insensitively on the trimmed address', () => {
    expect(emailMatches('  Dev@Example.com ')).toEqual({
      email: { equals: 'Dev@Example.com', mode: 'insensitive' },
    })
  })
})
