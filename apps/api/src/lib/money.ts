import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * A USDC amount as a decimal string. Money columns are Decimal(18, 7): at most 11 integer
 * digits and 7 decimals. A longer value used to pass validation and fail at the database as
 * a 500 instead of a 400.
 */
export const DecimalAmountSchema = z
  .string()
  .regex(/^\d{1,11}(\.\d{1,7})?$/, 'Must be a decimal string with up to 11 digits and 7 decimal places (e.g. "25.0000000")')

/** A strictly positive USDC amount (compared in Decimal, never as a float). */
export const PositiveAmountSchema = DecimalAmountSchema.refine(
  (v) => new Decimal(v).greaterThan(0),
  'Amount must be greater than 0',
)
