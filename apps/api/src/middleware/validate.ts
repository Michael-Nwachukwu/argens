import type { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'
import { sendError } from '../lib/response.js'

/**
 * Validates req.body against a Zod schema.
 * Strips unknown fields (strict mode via .strict() on the schema where needed).
 * Returns 400 with structured errors on failure.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      sendError(res, 'Validation failed', 'VALIDATION_ERROR', 400, errors)
      return
    }
    req.body = result.data
    next()
  }
}
