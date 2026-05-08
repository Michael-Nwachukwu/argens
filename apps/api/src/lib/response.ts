import type { Response } from 'express'
import { Decimal } from '@prisma/client/runtime/library'

// Recursively convert Prisma Decimal objects to 7dp strings for JSON output.
// This ensures no floating-point values ever leave the API.
function serializeDecimals(value: unknown): unknown {
  if (value instanceof Decimal) return value.toFixed(7)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(serializeDecimals)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serializeDecimals(v)])
    )
  }
  return value
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ data: serializeDecimals(data) })
}

export function sendError(
  res: Response,
  message: string,
  code: string,
  statusCode: number,
  details?: unknown,
): void {
  const body: Record<string, unknown> = { error: message, code }
  if (details !== undefined) body['details'] = details
  res.status(statusCode).json(body)
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; total: number; pages: number },
): void {
  res.status(200).json({ data: serializeDecimals(data), meta })
}
