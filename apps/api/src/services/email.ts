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
    // In dev without a verified domain, override `to` so emails actually arrive.
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
  console.log('\n📧  EMAIL PREVIEW:', previewUrl, '\n')
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getUserEmail(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (!user) throw new Error(`User ${userId} not found — cannot send email`)
  return user.email
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ─── Brand email shell ────────────────────────────────────────────────────────
//
// All templates are wrapped in this shell. It renders correctly in Gmail,
// Apple Mail, and Outlook. Uses inline styles only — no CSS classes.
// Background is warm off-white to match the Argens brand palette.

const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'

function buildEmailHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
</head>
<body style="margin:0;padding:0;background-color:#F3F0EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0" border="0">

          <!-- Header -->
          <tr>
            <td style="background-color:#0C0B0A;border-radius:10px 10px 0 0;padding:22px 32px;">
              <span style="font-size:18px;font-weight:700;letter-spacing:-0.3px;color:#EDE9E3;font-family:Georgia,'Times New Roman',serif;">argens</span>
              <span style="font-size:10px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#C5A253;margin-left:10px;vertical-align:middle;">beta</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#FFFFFF;padding:36px 32px;border-left:1px solid #E2DDD8;border-right:1px solid #E2DDD8;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#EAE6E1;border-radius:0 0 10px 10px;padding:20px 32px;border:1px solid #E2DDD8;border-top:none;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#8C8480;line-height:1.5;">
                You're receiving this because you have an Argens account.
              </p>
              <p style="margin:0;font-size:12px;color:#8C8480;line-height:1.5;">
                <a href="${FRONTEND_URL}" style="color:#8C8480;text-decoration:underline;">argens.xyz</a>
                &nbsp;·&nbsp;
                <a href="mailto:hello@argens.io" style="color:#8C8480;text-decoration:underline;">hello@argens.io</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Reusable building blocks ─────────────────────────────────────────────────

function ctaButton(label: string, href: string, color = '#C5A253'): string {
  const textColor = color === '#C5A253' ? '#0C0B0A' : '#FFFFFF'
  return `<a href="${href}" style="display:inline-block;background-color:${color};color:${textColor};font-size:14px;font-weight:600;padding:13px 26px;border-radius:7px;text-decoration:none;letter-spacing:0.1px;margin-top:24px;">${label}</a>`
}

function statusBadge(label: string, color: string, bg: string): string {
  return `<span style="display:inline-block;background-color:${bg};color:${color};font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:4px;">${label}</span>`
}

function dataTable(rows: Array<[string, string]>): string {
  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td style="padding:9px 0;font-size:13px;color:#9C9490;white-space:nowrap;width:140px;vertical-align:top;">${label}</td>
      <td style="padding:9px 0 9px 16px;font-size:13px;color:#1A1714;font-family:'Courier New',Courier,monospace;word-break:break-all;">${value}</td>
    </tr>`).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;border-top:1px solid #EAE6E1;">${rowsHtml}</table>`
}

function sectionHeading(text: string): string {
  return `<h2 style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:#0C0B0A;letter-spacing:-0.3px;">${text}</h2>`
}

function bodyText(text: string): string {
  return `<p style="margin:12px 0 0 0;font-size:15px;color:#4A4644;line-height:1.65;">${text}</p>`
}

function mutedText(text: string): string {
  return `<p style="margin:16px 0 0 0;font-size:12px;color:#9C9490;line-height:1.6;">${text}</p>`
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #EAE6E1;margin:24px 0;" />`
}

// ─── Phase 1 templates (email address passed directly) ───────────────────────

export function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${FRONTEND_URL}/auth/verify?token=${token}`

  const html = buildEmailHtml(`
    ${sectionHeading('Confirm your email')}
    ${bodyText("You're one step away from activating your Argens agent wallet. Click the button below to verify your email address and get started.")}
    ${ctaButton('Verify email address', link)}
    ${divider()}
    ${mutedText("This link expires in <strong>24 hours</strong>. If you didn't create an Argens account, you can safely ignore this email — no account will be created.")}
  `)

  const text = `Welcome to Argens.\n\nVerify your email to activate your agent wallet:\n\n${link}\n\nThis link expires in 24 hours. If you didn't sign up, ignore this email.`

  return sendEmail({ to, subject: 'Verify your Argens account', html, text })
}

export function sendWalletReadyEmail(to: string, publicKey: string): Promise<void> {
  const html = buildEmailHtml(`
    ${statusBadge('Wallet active', '#2E7D53', '#EAF4ED')}
    <div style="height:14px;"></div>
    ${sectionHeading('Your wallet is live on Stellar')}
    ${bodyText("Fund it with USDC and your AI agent can start making payments within the policy limits you define.")}
    ${dataTable([
      ['Deposit address', escapeHtml(publicKey)],
      ['Network', 'Stellar Mainnet'],
      ['Asset', 'USDC'],
    ])}
    ${ctaButton('View your wallet', `${FRONTEND_URL}/wallet`)}
    ${divider()}
    ${mutedText("Send USDC to the address above from any Stellar-compatible wallet or exchange. Your balance will appear in the dashboard within a few seconds of the transaction confirming.")}
  `)

  const text = `Your Argens wallet is ready.\n\nDeposit address: ${publicKey}\nNetwork: Stellar Mainnet\nAsset: USDC\n\nFund it and your agent can start paying.\n\n${FRONTEND_URL}/wallet`

  return sendEmail({ to, subject: 'Your Argens wallet is ready', html, text })
}

export function sendApiKeyRegeneratedEmail(to: string): Promise<void> {
  const html = buildEmailHtml(`
    ${statusBadge('Security notice', '#7A4F1A', '#FDF4E7')}
    <div style="height:14px;"></div>
    ${sectionHeading('Your API key was regenerated')}
    ${bodyText("Any agents or integrations using the previous API key will stop working immediately. Update them with the new key from your dashboard.")}
    ${ctaButton('Go to API keys', `${FRONTEND_URL}/api-keys`)}
    ${divider()}
    ${mutedText("If you did not regenerate this key, someone else may have access to your account. Contact us immediately at <a href='mailto:hello@argens.io' style='color:#9C9490;'>hello@argens.io</a>.")}
  `)

  const text = `Your Argens API key was regenerated.\n\nAny agents using the old key will stop working. Update them with the new key from your dashboard.\n\n${FRONTEND_URL}/api-keys\n\nIf you didn't do this, contact hello@argens.io immediately.`

  return sendEmail({ to, subject: 'Your Argens API key was regenerated', html, text })
}

// ─── Phase 2 templates (userId passed — email looked up internally) ───────────

export async function sendBlockedEmail(
  userId: string,
  transactionId: string,
  amount: string,
  recipient: string,
  reason: string,
): Promise<void> {
  const to = await getUserEmail(userId)

  const reasonLabels: Record<string, string> = {
    max_transaction_exceeded: 'Exceeded max transaction limit',
    allowance_exceeded: 'Exceeded allowance limit',
    policy_violation: 'Violated spending policy',
  }
  const reasonLabel = reasonLabels[reason] ?? reason

  const html = buildEmailHtml(`
    ${statusBadge('Payment blocked', '#A04848', '#FAF0F0')}
    <div style="height:14px;"></div>
    ${sectionHeading('A payment was blocked')}
    ${bodyText("Your agent attempted a payment that exceeded your current policy. No funds were moved.")}
    ${dataTable([
      ['Amount', `${escapeHtml(amount)} USDC`],
      ['Recipient', escapeHtml(recipient)],
      ['Block reason', escapeHtml(reasonLabel)],
      ['Transaction ID', escapeHtml(transactionId)],
    ])}
    ${ctaButton('Review your policies', `${FRONTEND_URL}/policies`)}
    ${divider()}
    ${mutedText("If this payment was intentional, raise your policy limits in the dashboard and have your agent retry.")}
  `)

  const text = `A payment was blocked by your Argens policy.\n\nAmount: ${amount} USDC\nRecipient: ${recipient}\nReason: ${reasonLabel}\nTransaction ID: ${transactionId}\n\nReview your policies: ${FRONTEND_URL}/policies`

  return sendEmail({ to, subject: `Payment blocked — ${amount} USDC`, html, text })
}

export async function sendPendingApprovalEmail(
  userId: string,
  transactionId: string,
  token: string,
  amount: string,
  recipient: string,
): Promise<void> {
  const to = await getUserEmail(userId)
  // Link to dashboard confirmation page — user clicks Approve/Reject there.
  // Dashboard issues POST /v1/approve/:token — never a GET state change.
  const confirmUrl = `${FRONTEND_URL}/approve/confirm?token=${token}`

  const html = buildEmailHtml(`
    ${statusBadge('Awaiting your approval', '#6B7FAF', '#F0F2F8')}
    <div style="height:14px;"></div>
    ${sectionHeading('A payment needs your approval')}
    ${bodyText("Your agent requested a payment that exceeds your approval threshold. Review the details below and decide.")}
    ${dataTable([
      ['Amount', `${escapeHtml(amount)} USDC`],
      ['Recipient', escapeHtml(recipient)],
      ['Transaction ID', escapeHtml(transactionId)],
    ])}
    ${ctaButton('Review and approve', confirmUrl, '#0C0B0A')}
    ${divider()}
    ${mutedText("This link expires in <strong>24 hours</strong> and can only be used once. It opens a secure page where you can inspect the full transaction before approving or rejecting. No action will be taken until you explicitly confirm.")}
  `)

  const text = `A payment requires your approval.\n\nAmount: ${amount} USDC\nRecipient: ${recipient}\nTransaction ID: ${transactionId}\n\nReview and approve or reject at:\n${confirmUrl}\n\nThis link expires in 24 hours.`

  return sendEmail({ to, subject: `Approval required — ${amount} USDC`, html, text })
}

export async function sendApprovalActedEmail(
  userId: string,
  transactionId: string,
  action: 'approved' | 'rejected',
  amount: string,
): Promise<void> {
  const to = await getUserEmail(userId)

  const isApproved = action === 'approved'
  const badge = isApproved
    ? statusBadge('Approved', '#2E7D53', '#EAF4ED')
    : statusBadge('Rejected', '#A04848', '#FAF0F0')

  const heading = isApproved ? 'Payment approved and submitted' : 'Payment rejected'
  const detail = isApproved
    ? 'The payment has been submitted to the Stellar network and will settle shortly.'
    : 'The payment was rejected. No funds were moved from your wallet.'

  const html = buildEmailHtml(`
    ${badge}
    <div style="height:14px;"></div>
    ${sectionHeading(heading)}
    ${bodyText(detail)}
    ${dataTable([
      ['Amount', `${escapeHtml(amount)} USDC`],
      ['Transaction ID', escapeHtml(transactionId)],
    ])}
    ${ctaButton('View transaction', `${FRONTEND_URL}/transactions/${transactionId}`)}
  `)

  const text = `Payment ${action}.\n\nAmount: ${amount} USDC\nTransaction ID: ${transactionId}\n\n${detail}\n\nView details: ${FRONTEND_URL}/transactions/${transactionId}`

  return sendEmail({ to, subject: `Payment ${action} — ${amount} USDC`, html, text })
}

export async function sendLowBalanceEmail(
  userId: string,
  currentBalance: string,
  threshold: string,
): Promise<void> {
  const to = await getUserEmail(userId)

  const html = buildEmailHtml(`
    ${statusBadge('Low balance', '#B8832A', '#FDF5E7')}
    <div style="height:14px;"></div>
    ${sectionHeading('Your wallet balance is running low')}
    ${bodyText("Your agent may not be able to complete future payments. Fund your wallet now to keep it running.")}
    ${dataTable([
      ['Current balance', `${escapeHtml(currentBalance)} USDC`],
      ['Warning threshold', `${escapeHtml(threshold)} USDC`],
    ])}
    ${ctaButton('Fund your wallet', `${FRONTEND_URL}/wallet`)}
    ${divider()}
    ${mutedText("Payments will continue as long as your balance is above $0, but blocked or failed payments may disrupt your agent's workflow.")}
  `)

  const text = `Your Argens wallet balance is low.\n\nCurrent balance: ${currentBalance} USDC\nWarning threshold: ${threshold} USDC\n\nFund your wallet: ${FRONTEND_URL}/wallet`

  return sendEmail({ to, subject: 'Low wallet balance — fund your agent', html, text })
}

export async function sendWalletFundedEmail(
  userId: string,
  depositAmount: string,
  newBalance: string,
): Promise<void> {
  const to = await getUserEmail(userId)

  const html = buildEmailHtml(`
    ${statusBadge('Deposit received', '#2E7D53', '#EAF4ED')}
    <div style="height:14px;"></div>
    ${sectionHeading(`${escapeHtml(depositAmount)} USDC received`)}
    ${bodyText("Your wallet has been funded. Your agent can now make payments within your policy limits.")}
    ${dataTable([
      ['Deposit amount', `${escapeHtml(depositAmount)} USDC`],
      ['New balance', `${escapeHtml(newBalance)} USDC`],
    ])}
    ${ctaButton('View your wallet', `${FRONTEND_URL}/wallet`)}
  `)

  const text = `Your Argens wallet received ${depositAmount} USDC.\n\nNew balance: ${newBalance} USDC\n\nYour agent is ready to pay.\n\n${FRONTEND_URL}/wallet`

  return sendEmail({ to, subject: `${depositAmount} USDC received`, html, text })
}

export async function sendCreditsGrantedEmail(
  userId: string,
  amount: string,
  expiresAt: Date,
  reason?: string | null,
): Promise<void> {
  const to = await getUserEmail(userId)
  const cleanReason = reason?.trim() ?? ''
  const escapedReason = escapeHtml(cleanReason)

  const expiryFormatted = expiresAt.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const reasonRow: [string, string][] = cleanReason ? [['Reason', escapedReason]] : []

  const html = buildEmailHtml(`
    ${statusBadge('Credits added', '#6B7FAF', '#F0F2F8')}
    <div style="height:14px;"></div>
    ${sectionHeading(`${escapeHtml(amount)} USDC in marketplace credits`)}
    ${bodyText("Argens has added credits to your account. Credits can be used to pay for marketplace service calls without touching your USDC balance.")}
    ${dataTable([
      ['Credits added', `${escapeHtml(amount)} USDC`],
      ['Expires', expiryFormatted],
      ...reasonRow,
    ])}
    ${ctaButton('Explore the marketplace', `${FRONTEND_URL}/marketplace`)}
    ${divider()}
    ${mutedText("Credits apply to marketplace service calls only. They are not withdrawable and do not count toward direct wallet transfers. Unused credits expire on the date shown above.")}
  `)

  const text = `You received ${amount} USDC in Argens marketplace credits.\n\nExpires: ${expiresAt.toISOString()}\n${cleanReason ? `Reason: ${cleanReason}\n` : ''}\nUse them in the marketplace: ${FRONTEND_URL}/marketplace`

  return sendEmail({ to, subject: `${amount} USDC marketplace credits added`, html, text })
}

/**
 * Sent to the operator (ADMIN_ALERT_EMAIL) when an Argens-operated wallet
 * drops below its configured threshold. Not sent to end users.
 */
export async function sendOpsAlertEmail(alerts: Array<{
  wallet: string
  asset: 'XLM' | 'USDC'
  balance: string
  threshold: string
  note?: string
}>): Promise<void> {
  const adminEmail = process.env['ADMIN_ALERT_EMAIL']
  if (!adminEmail) return

  const rows: Array<[string, string]> = []
  for (const a of alerts) {
    rows.push([`${a.wallet} (${a.asset})`, `${a.balance} — threshold: ${a.threshold}${a.note ? ` · ${a.note}` : ''}`])
  }

  const html = buildEmailHtml(`
    ${statusBadge('Ops alert', '#A04848', '#FAF0F0')}
    <div style="height:14px;"></div>
    ${sectionHeading('Wallet balance below threshold')}
    ${bodyText("One or more Argens-operated wallets is running low. Fund them before they cause user-facing failures.")}
    ${dataTable(rows)}
    ${divider()}
    ${mutedText("A depleted ops wallet silently breaks new user signups. A depleted credit pool blocks credit-funded marketplace calls. This alert fires once per 24 hours until the balance is restored.")}
  `)

  const text = `Argens ops alert: wallet balance below threshold.\n\n${alerts.map(a => `${a.wallet} (${a.asset}): ${a.balance} (threshold ${a.threshold})`).join('\n')}`

  await sendEmail({ to: adminEmail, subject: '[Argens Ops] Wallet balance alert', html, text })
}

export async function sendPolicyChangedEmail(
  userId: string,
  policies: {
    allowanceLimit: string | null
    maxTransactionLimit: string | null
    approvalThreshold: string | null
  },
): Promise<void> {
  const to = await getUserEmail(userId)

  const rows: Array<[string, string]> = []
  if (policies.allowanceLimit !== null) rows.push(['Allowance limit', `${policies.allowanceLimit} USDC`])
  if (policies.maxTransactionLimit !== null) rows.push(['Max transaction', `${policies.maxTransactionLimit} USDC`])
  if (policies.approvalThreshold !== null) rows.push(['Approval threshold', `${policies.approvalThreshold} USDC`])

  const summaryHtml = rows.length > 0
    ? dataTable(rows)
    : `<p style="margin:16px 0;font-size:13px;color:#9C9490;font-style:italic;">All policy limits have been cleared — no spending restrictions are active.</p>`

  const html = buildEmailHtml(`
    ${statusBadge('Policy updated', '#706B65', '#EAE6E1')}
    <div style="height:14px;"></div>
    ${sectionHeading('Spending policies updated')}
    ${bodyText("Your Argens spending policies were just updated. Here's a summary of the new settings:")}
    ${summaryHtml}
    ${ctaButton('Review your policies', `${FRONTEND_URL}/policies`)}
    ${divider()}
    ${mutedText("If you did not make this change, contact us immediately at <a href='mailto:hello@argens.io' style='color:#9C9490;'>hello@argens.io</a>.")}
  `)

  const text = `Your Argens spending policies were updated.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n') || 'All limits cleared.'}\n\nIf you didn't make this change, contact hello@argens.io immediately.\n\n${FRONTEND_URL}/policies`

  return sendEmail({ to, subject: 'Spending policies updated', html, text })
}
