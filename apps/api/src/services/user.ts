import type { Prisma } from '@prisma/client'

/**
 * Emails are matched case-insensitively. Signup stores new emails lowercased, but accounts
 * created before that keep whatever case they were typed in, and the unique index on
 * User.email is case-sensitive — so never look a user up with an exact-match findUnique.
 *
 * Use with findFirst + byEmailOldestFirst, so the result is deterministic if two rows
 * differ only by case.
 */
export function emailMatches(email: string): Prisma.UserWhereInput {
  return { email: { equals: email.trim(), mode: 'insensitive' } }
}

export const byEmailOldestFirst = { createdAt: 'asc' } satisfies Prisma.UserOrderByWithRelationInput
