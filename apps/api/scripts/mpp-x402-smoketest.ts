/**
 * scripts/mpp-x402-smoketest.ts
 *
 * Live smoke test for the x402 v2 marketplace payment path against MPP Router,
 * WITHOUT going through the full HTTP API / auth. It decrypts a real funded
 * wallet straight from the DB and drives `performMppRequest` (the same code path
 * production uses) against a real upstream service on mainnet.
 *
 * This is the verification harness for the MPP Router x402 migration: it lets us
 * confirm a real successful charge locally before deploying. NOTE: a successful
 * run spends real USDC from the wallet (one cheap service call).
 *
 * Usage:
 *   MPP_SMOKETEST_EMAIL=bldn.inc@gmail.com \
 *   MPP_SMOKETEST_SERVICE_URL=https://apiserver.mpprouter.dev/v1/services/stableemail/send \
 *   npx tsx scripts/mpp-x402-smoketest.ts
 *
 * Requires (from apps/api/.env): DATABASE_URL, ENCRYPTION_KEY, STELLAR_NETWORK,
 * SOROBAN_RPC_URL.
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { decryptSecretKey } from '../src/lib/crypto.js'
import { performMppRequest } from '../src/services/mpp-client.js'

const prisma = new PrismaClient()

const EMAIL = process.env['MPP_SMOKETEST_EMAIL'] ?? 'bldn.inc@gmail.com'
const SERVICE_URL =
  process.env['MPP_SMOKETEST_SERVICE_URL'] ??
  'https://apiserver.mpprouter.dev/v1/services/stableemail/send'
const PAYLOAD = process.env['MPP_SMOKETEST_PAYLOAD'] ??
  JSON.stringify({ to: [EMAIL], subject: 'Argens x402 smoke test', text: 'x402 v2 smoke test', replyTo: EMAIL })

async function main() {
  const wallet = await prisma.wallet.findFirst({
    where: { user: { email: EMAIL } },
    select: { stellarPublicKey: true, stellarSecretKeyEnc: true },
  })
  if (!wallet) throw new Error(`No wallet for ${EMAIL}`)

  const secretKey = decryptSecretKey(wallet.stellarSecretKeyEnc)
  console.log('Wallet :', wallet.stellarPublicKey)
  console.log('Service:', SERVICE_URL)
  console.log('Network:', process.env['STELLAR_NETWORK'], '| RPC:', process.env['SOROBAN_RPC_URL'])
  console.log('\n--- performMppRequest (x402 v2) ---\n')

  const result = await performMppRequest({
    secretKey,
    url: SERVICE_URL,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: PAYLOAD,
    onChallenge: async (c) => {
      console.log(
        `  challenge: method=${c.method} intent=${c.intent} amount=${c.amount} ` +
          `currency=${c.currency?.slice(0, 10)}… recipient=${c.recipient?.slice(0, 10)}…`,
      )
    },
  })

  console.log('\n=== RESULT ===')
  console.log('ok        :', result.ok, '| status:', result.status)
  console.log('progress  :', result.progress.map((p) => p['type']).join(' -> '))
  console.log('receipt   :', JSON.stringify(result.receipt))
  console.log('body      :', typeof result.body === 'string' ? result.body.slice(0, 500) : JSON.stringify(result.body).slice(0, 500))
  await prisma.$disconnect()
}

main().catch((e: unknown) => {
  const err = e as { name?: string; message?: string }
  console.error('THROWN:', err.name, '-', err.message)
  process.exit(1)
})
