/**
 * services/email.ts
 *
 * Transactional email service — Ethereal (dev) or Resend (prod).
 *
 * Pattern for Phase 2 functions: take `userId`, look up the email internally.
 * Phase 1 functions (auth flow) still take `to: string` directly because
 * the email address is already in scope at the call site.
 *
 * All functions are fire-and-forget safe — they return Promise<void>.
 * Callers should `.catch()` to log failures without crashing the request.
 */

import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'

// ─── Types ───────────────────────────────────────────────────────────────────

type EmailPayload = {
  to: string
  subject: string
  html: string
  text: string
}

// ─── Ethereal transport (singleton) ──────────────────────────────────────────

let etherealTransport: nodemailer.Transporter | null = null

async function getEtherealTransport(): Promise<nodemailer.Transporter> {
  if (etherealTransport) return etherealTransport
  const testAccount = await nodemailer.createTestAccount()
  etherealTransport = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
  })
  logger.info('Ethereal test email account created', { user: testAccount.user })
  return etherealTransport
}

// ─── sendEmail ────────────────────────────────────────────────────────────────

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const provider = process.env['EMAIL_PROVIDER'] ?? 'ethereal'

  if (provider === 'resend') {
    const apiKey = process.env['RESEND_API_KEY']
    if (!apiKey) throw new Error('RESEND_API_KEY not set')
    const resend = new Resend(apiKey)
    const from = process.env['RESEND_FROM_EMAIL'] ?? 'noreply@argens.io'
    // In dev without a verified domain, onboarding@resend.dev can only send to
    // the Resend account owner. Override the `to` so emails actually arrive.
    // Empty string or unset = no override → send to actual recipient.
    const overrideRaw = process.env['NODE_ENV'] !== 'production' ? process.env['RESEND_DEV_OVERRIDE_TO'] : undefined
    const devOverride = overrideRaw && overrideRaw.length > 0 ? overrideRaw : undefined
    const to = devOverride ?? payload.to
    const { error } = await resend.emails.send({ from, ...payload, to })
    if (error) throw new Error(`Resend error: ${error.message}`)
    logger.info('Email sent via Resend', { to, subject: payload.subject })
    return
  }

  // Ethereal — catches all emails in a test inbox, shows preview URL in console.
  const transport = await getEtherealTransport()
  const info = await transport.sendMail({
    from: '"Argens" <noreply@argens.io>',
    ...payload,
  })
  const previewUrl = nodemailer.getTestMessageUrl(info)
  logger.info('Email sent via Ethereal', {
    to: payload.to,
    subject: payload.subject,
    previewUrl,
  })
  // Print directly — impossible to miss in the dev terminal.
  console.log('\n📧  EMAIL PREVIEW:', previewUrl, '\n')
}

// ─── Internal helper: look up email by userId ────────────────────────────────

async function getUserEmail(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (!user) throw new Error(`User ${userId} not found — cannot send email`)
  return user.email
}

// ─── Config ───────────────────────────────────────────────────────────────────

const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'

// ─── Phase 1 templates (email address passed directly) ───────────────────────

export function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${FRONTEND_URL}/auth/verify?token=${token}`
  return sendEmail({
    to,
    subject: 'Verify your Argens account',
    text: `Click this link to verify your email and activate your wallet:\n\n${link}\n\nThis link expires in 24 hours.`,
    html: `
      <p>Welcome to Argens.</p>
      <p><a href="${link}">Verify your email address</a> to activate your agent wallet.</p>
      <p>This link expires in 24 hours.</p>
      <p style="font-size:12px;color:#888">If you didn't sign up for Argens, ignore this email.</p>
    `,
  })
}

export function sendWalletReadyEmail(to: string, publicKey: string): Promise<void> {
  return sendEmail({
    to,
    subject: 'Your Argens wallet is ready',
    text: `Your wallet is live on Stellar.\n\nDeposit address: ${publicKey}\n\nFund it with USDC and your agent can start paying.`,
    html: `
      <p>Your Argens wallet is ready.</p>
      <p><strong>Deposit address:</strong> <code>${publicKey}</code></p>
      <p>Fund it with USDC and your agent can start paying within your policies.</p>
      <p><a href="${FRONTEND_URL}/wallet">View your wallet</a></p>
    `,
  })
}

export function sendApiKeyRegeneratedEmail(to: string): Promise<void> {
  return sendEmail({
    to,
    subject: 'Your Argens API key has been regenerated',
    text: 'Your API key was regenerated. Any agents using the old key will stop working. Update them with the new key from your dashboard.',
    html: `
      <p>Your Argens API key was regenerated.</p>
      <p>Any agents using the old key will stop working immediately. Update them with the new key from your <a href="${FRONTEND_URL}/api-keys">dashboard</a>.</p>
    `,
  })
}

// ─── Phase 2 templates (userId passed — email looked up internally) ───────────

/**
 * Sent when a transaction is blocked by policy.
 */
export async function sendBlockedEmail(
  userId: string,
  transactionId: string,
  amount: string,
  recipient: string,
  reason: string,
): Promise<void> {
  const to = await getUserEmail(userId)
  const reasonText: Record<string, string> = {
    max_transaction_exceeded: 'exceeded your maximum transaction limit',
    allowance_exceeded: 'would have exceeded your allowance limit',
    policy_violation: 'violated your spending policy',
  }
  const reasonLabel = reasonText[reason] ?? reason

  return sendEmail({
    to,
    subject: 'Argens: Payment blocked by policy',
    text: `A payment of ${amount} USDC to ${recipient} was blocked because it ${reasonLabel}.\n\nTransaction ID: ${transactionId}\n\nReview and adjust your policies at ${FRONTEND_URL}/policies`,
    html: `
      <p><strong>A payment was blocked by your policy.</strong></p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 8px;color:#888">Amount</td><td style="padding:4px 8px">${amount} USDC</td></tr>
        <tr><td style="padding:4px 8px;color:#888">Recipient</td><td style="padding:4px 8px"><code>${recipient}</code></td></tr>
        <tr><td style="padding:4px 8px;color:#888">Reason</td><td style="padding:4px 8px">${reasonLabel}</td></tr>
        <tr><td style="padding:4px 8px;color:#888">Transaction ID</td><td style="padding:4px 8px">${transactionId}</td></tr>
      </table>
      <p><a href="${FRONTEND_URL}/policies">Review your spending policies</a> &nbsp;|&nbsp; <a href="${FRONTEND_URL}/transactions">View transactions</a></p>
    `,
  })
}

/**
 * Sent when a transaction requires developer approval.
 * Email links to the dashboard confirmation page — NOT a direct action URL.
 * The user clicks "Approve" or "Reject" on the dashboard, which submits POST.
 */
export async function sendPendingApprovalEmail(
  userId: string,
  transactionId: string,
  token: string,
  amount: string,
  recipient: string,
): Promise<void> {
  const to = await getUserEmail(userId)
  // Link to dashboard confirmation page — user must click Approve/Reject button there.
  // The dashboard submits POST /v1/approve/:token — never a GET state change.
  const confirmUrl = `${FRONTEND_URL}/approve/confirm?token=${token}`

  return sendEmail({
    to,
    subject: `Argens: Payment requires your approval — ${amount} USDC`,
    text: `A payment of ${amount} USDC to ${recipient} requires your approval.\n\nTransaction ID: ${transactionId}\n\nReview and approve or reject at:\n${confirmUrl}\n\nThis approval link expires in 24 hours.`,
    html: `
      <p><strong>A payment requires your approval.</strong></p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 8px;color:#888">Amount</td><td style="padding:4px 8px">${amount} USDC</td></tr>
        <tr><td style="padding:4px 8px;color:#888">Recipient</td><td style="padding:4px 8px"><code>${recipient}</code></td></tr>
        <tr><td style="padding:4px 8px;color:#888">Transaction ID</td><td style="padding:4px 8px">${transactionId}</td></tr>
      </table>
      <p style="margin-top:24px">
        <a href="${confirmUrl}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Review and approve</a>
      </p>
      <p style="font-size:12px;color:#888;margin-top:16px">This link expires in 24 hours. It takes you to the Argens dashboard where you can review the full transaction before approving or rejecting.</p>
    `,
  })
}

/**
 * Sent after a pending approval is acted on (approved or rejected).
 */
export async function sendApprovalActedEmail(
  userId: string,
  transactionId: string,
  action: 'approved' | 'rejected',
  amount: string,
): Promise<void> {
  const to = await getUserEmail(userId)
  const verb = action === 'approved' ? 'approved' : 'rejected'
  const detail =
    action === 'approved'
      ? 'The payment has been submitted to the Stellar network.'
      : 'No payment was made.'

  return sendEmail({
    to,
    subject: `Argens: Payment ${verb} — ${amount} USDC`,
    text: `Your pending payment of ${amount} USDC has been ${verb}. ${detail}\n\nTransaction ID: ${transactionId}\n\nView details: ${FRONTEND_URL}/transactions/${transactionId}`,
    html: `
      <p>Your pending payment of <strong>${amount} USDC</strong> was <strong>${verb}</strong>.</p>
      <p>${detail}</p>
      <p>Transaction ID: <code>${transactionId}</code></p>
      <p><a href="${FRONTEND_URL}/transactions/${transactionId}">View transaction details</a></p>
    `,
  })
}

/**
 * Sent when balance drops below the low-balance threshold after a payment.
 * Rate-limited to 1 per 24h per user by the caller.
 */
export async function sendLowBalanceEmail(
  userId: string,
  currentBalance: string,
  threshold: string,
): Promise<void> {
  const to = await getUserEmail(userId)

  return sendEmail({
    to,
    subject: 'Argens: Low wallet balance warning',
    text: `Your Argens wallet balance is low.\n\nCurrent balance: ${currentBalance} USDC\n\nYour agent may not be able to complete future payments. Fund your wallet at ${FRONTEND_URL}/wallet`,
    html: `
      <p><strong>Your Argens wallet balance is low.</strong></p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 8px;color:#888">Current balance</td><td style="padding:4px 8px">${currentBalance} USDC</td></tr>
        <tr><td style="padding:4px 8px;color:#888">Warning threshold</td><td style="padding:4px 8px">${threshold} USDC</td></tr>
      </table>
      <p>Your agent may not be able to complete future payments.</p>
      <p><a href="${FRONTEND_URL}/wallet" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block">Fund your wallet</a></p>
    `,
  })
}

/**
 * Sent when an incoming USDC deposit is detected on the wallet.
 * Rate-limited to 1 per 5 min per user by the watcher service.
 */
export async function sendWalletFundedEmail(
  userId: string,
  depositAmount: string,
  newBalance: string,
): Promise<void> {
  const to = await getUserEmail(userId)

  return sendEmail({
    to,
    subject: `Argens: ${depositAmount} USDC received`,
    text: `Your Argens wallet received ${depositAmount} USDC.\n\nNew balance: ${newBalance} USDC\n\nYour agent is ready to start paying. View your wallet: ${FRONTEND_URL}/wallet`,
    html: `
      <p>Your Argens wallet received <strong>${depositAmount} USDC</strong>.</p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 8px;color:#888">Deposited</td><td style="padding:4px 8px">${depositAmount} USDC</td></tr>
        <tr><td style="padding:4px 8px;color:#888">New balance</td><td style="padding:4px 8px">${newBalance} USDC</td></tr>
      </table>
      <p>Your agent is ready to pay within your policy limits.</p>
      <p><a href="${FRONTEND_URL}/wallet">View your wallet</a></p>
    `,
  })
}

/**
 * sendPolicyChangedEmail — called from routes/policies.ts after a policy update.
 */
export async function sendPolicyChangedEmail(
  userId: string,
  policies: {
    allowanceLimit: string | null
    maxTransactionLimit: string | null
    approvalThreshold: string | null
  },
): Promise<void> {
  const to = await getUserEmail(userId)

  const rows = [
    policies.allowanceLimit !== null
      ? `<tr><td style="padding:4px 8px;color:#888">Allowance limit</td><td>${policies.allowanceLimit} USDC</td></tr>`
      : '',
    policies.maxTransactionLimit !== null
      ? `<tr><td style="padding:4px 8px;color:#888">Max transaction</td><td>${policies.maxTransactionLimit} USDC</td></tr>`
      : '',
    policies.approvalThreshold !== null
      ? `<tr><td style="padding:4px 8px;color:#888">Approval threshold</td><td>${policies.approvalThreshold} USDC</td></tr>`
      : '',
  ]
    .filter(Boolean)
    .join('')

  return sendEmail({
    to,
    subject: 'Argens: Spending policies updated',
    text: `Your Argens spending policies were updated. View them at ${FRONTEND_URL}/policies\n\nIf you didn't make this change, contact support immediately.`,
    html: `
      <p><strong>Your spending policies were updated.</strong></p>
      <table style="border-collapse:collapse">${rows || '<tr><td style="padding:4px 8px">All limits cleared (no restrictions)</td></tr>'}</table>
      <p><a href="${FRONTEND_URL}/policies">View your policies</a></p>
      <p style="font-size:12px;color:#888">If you didn't make this change, contact support immediately.</p>
    `,
  })
}
