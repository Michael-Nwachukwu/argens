import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { logger } from '../lib/logger.js'

type EmailPayload = {
  to: string
  subject: string
  html: string
  text: string
}

// ─── Ethereal (dev) ────────────────────────────────────────────────────────────
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

// ─── Send ──────────────────────────────────────────────────────────────────────
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const provider = process.env['EMAIL_PROVIDER'] ?? 'ethereal'

  if (provider === 'resend') {
    const apiKey = process.env['RESEND_API_KEY']
    if (!apiKey) throw new Error('RESEND_API_KEY not set')
    const resend = new Resend(apiKey)
    const from = process.env['RESEND_FROM_EMAIL'] ?? 'noreply@argens.io'
    const { error } = await resend.emails.send({ from, ...payload })
    if (error) throw new Error(`Resend error: ${error.message}`)
    logger.info('Email sent via Resend', { to: payload.to, subject: payload.subject })
    return
  }

  // Ethereal — catches all emails, shows preview URL in console.
  const transport = await getEtherealTransport()
  const info = await transport.sendMail({
    from: '"Argens" <noreply@argens.io>',
    ...payload,
  })
  const previewUrl = nodemailer.getTestMessageUrl(info)
  logger.info('Email sent via Ethereal — preview URL below', {
    to: payload.to,
    subject: payload.subject,
    previewUrl,
  })
  // Also print directly so it's impossible to miss during dev.
  console.log('\n📧  EMAIL PREVIEW:', previewUrl, '\n')
}

// ─── Templates ─────────────────────────────────────────────────────────────────
const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'

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

export function sendPolicyChangedEmail(to: string): Promise<void> {
  return sendEmail({
    to,
    subject: 'Your Argens spending policies were updated',
    text: `Your spending policies were updated. View them at ${FRONTEND_URL}/policies`,
    html: `
      <p>Your Argens spending policies were updated.</p>
      <p><a href="${FRONTEND_URL}/policies">View your current policies</a></p>
      <p style="font-size:12px;color:#888">If you didn't make this change, contact support immediately.</p>
    `,
  })
}
