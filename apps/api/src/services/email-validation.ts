/**
 * services/email-validation.ts
 *
 * Signup-time email validation — "only valid real emails are accepted".
 *
 * Layered defence (the email verification link is still the ultimate gate):
 *   1. Strict syntactic check.
 *   2. Disposable / throwaway provider blocklist (hard reject).
 *   3. DNS MX (with A/AAAA fallback) lookup — reject domains that conclusively
 *      cannot receive mail. On a DNS timeout/hiccup we ALLOW (don't punish a legit
 *      signup for a transient resolver problem); a non-existent domain still fails
 *      because the verification email bounces and the wallet never gets bootstrapped.
 */

import { promises as dns } from 'dns'
import { logger } from '../lib/logger.js'

export class EmailRejectedError extends Error {
  readonly code = 'EMAIL_REJECTED'
  readonly statusCode = 422
  constructor(message: string) {
    super(message)
    this.name = 'EmailRejectedError'
  }
}

// Common disposable / temporary email providers. Not exhaustive — catches the bulk of them.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.biz',
  'guerrillamail.org', 'guerrillamail.net', 'guerrillamailblock.com', 'grr.la', 'sharklasers.com',
  '10minutemail.com', '10minutemail.net', '20minutemail.com', '30minutemail.com', '10minemail.com',
  'temp-mail.org', 'temp-mail.io', 'tempmail.com', 'tempmailo.com', 'tempr.email', 'tempmail.plus',
  'throwawaymail.com', 'throwaway.email', 'getnada.com', 'nada.email', 'dispostable.com',
  'yopmail.com', 'yopmail.net', 'yopmail.fr', 'cool.fr.nf', 'jetable.fr.nf', 'mail.tm',
  'maildrop.cc', 'mailnesia.com', 'mintemail.com', 'mohmal.com', 'moakt.com', 'tmpmail.org',
  'trashmail.com', 'trash-mail.com', 'spam4.me', 'fakeinbox.com', 'tempinbox.com', 'tmail.ws',
  'mailcatch.com', 'emailondeck.com', 'mailsac.com', 'inboxbear.com', 'discard.email',
  'spambox.us', 'mvrht.net', 'maileator.com', 'incognitomail.org', 'getairmail.com', 'burnermail.io',
  'einrot.com', 'fakemailgenerator.com', 'mailtemp.info', 'tempemail.co', 'luxusmail.org',
])

const EMAIL_RE = /^[^\s@"']+@[^\s@"']+\.[^\s@"'.]{2,}$/

const DNS_TIMEOUT_MS = 3000

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('DNS_TIMEOUT')), ms)),
  ])
}

/**
 * Throws EmailRejectedError if the email is malformed, disposable, or its domain
 * conclusively cannot receive mail. Resolves on a "probably fine" verdict.
 */
export async function assertDeliverableEmail(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase()

  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw new EmailRejectedError('That email address is not valid.')
  }

  const domain = email.slice(email.lastIndexOf('@') + 1)

  if (DISPOSABLE_DOMAINS.has(domain)) {
    throw new EmailRejectedError('Disposable or temporary email addresses are not accepted. Please use a permanent email.')
  }

  try {
    const mx = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS)
    if (mx && mx.length > 0) return
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'DNS_TIMEOUT') {
      logger.warn('Email domain MX check timed out — allowing signup', { domain })
      return // don't block on a transient resolver problem
    }
    // ENOTFOUND / ENODATA / SERVFAIL etc. fall through to the A-record fallback below.
  }

  // RFC 5321 §5.1: a domain with no MX but an A/AAAA record may still accept mail.
  try {
    const a = await withTimeout(dns.lookup(domain), DNS_TIMEOUT_MS)
    if (a && a.address) return
  } catch (e) {
    if ((e as Error).message === 'DNS_TIMEOUT') {
      logger.warn('Email domain A-record check timed out — allowing signup', { domain })
      return
    }
  }

  throw new EmailRejectedError(`The email domain "${domain}" does not appear to accept mail. Check for typos.`)
}
