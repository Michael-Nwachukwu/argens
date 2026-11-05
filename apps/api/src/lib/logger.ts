const isDev = process.env['NODE_ENV'] !== 'production'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  }
  // Never log sensitive fields — strip them if accidentally passed
  const safe = { ...entry }
  for (const key of ['secretKey', 'password', 'passwordHash', 'stellarSecretKeyEnc', 'token', 'apiKey']) {
    if (key in safe) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (safe as Record<string, unknown>)[key]
      ;(safe as Record<string, unknown>)['[REDACTED]'] = key
    }
  }
  const out = isDev ? JSON.stringify(safe, null, 2) : JSON.stringify(safe)
  if (level === 'error') {
    console.error(out)
  } else {
    console.log(out)
  }
}

export const logger = {
  info:  (message: string, meta?: Record<string, unknown>) => log('info',  message, meta),
  warn:  (message: string, meta?: Record<string, unknown>) => log('warn',  message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (isDev) log('debug', message, meta)
  },
}

/**
 * `.catch()` handler for fire-and-forget work (cache refreshes, notification emails).
 * The request has already succeeded, so a failure must not throw — but it must be visible.
 */
export function logBackgroundFailure(task: string, meta?: Record<string, unknown>) {
  return (e: unknown): void => {
    log('warn', `Background task failed: ${task}`, { ...meta, error: e instanceof Error ? e.message : String(e) })
  }
}
