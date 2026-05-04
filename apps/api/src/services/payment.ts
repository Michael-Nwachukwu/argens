/**
 * services/payment.ts
 *
 * Stellar payment execution for Argens.
 *
 * Every payment is a two-operation atomic Stellar transaction:
 *   Op 1 → recipient (requested amount)
 *   Op 2 → ARGENS_FEE_WALLET (0.5% fee, rounded down, favour user)
 *
 * Both operations succeed or both fail — an agent is never charged a fee
 * for a payment that didn't execute, and Argens never collects a fee
 * without the recipient being paid.
 *
 * Amount handling:
 *   - All amounts in this file are STRING "25.0000000" — never JS numbers
 *   - Fee arithmetic uses Prisma Decimal — never floating point
 *   - Stellar SDK accepts and returns string amounts
 */

import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Memo,
} from '@stellar/stellar-sdk'
import { Decimal } from '@prisma/client/runtime/library'
import { HORIZON_URL, NETWORK_PASSPHRASE, USDC_ASSET } from './stellar.js'
import { StellarError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

// ─── Config ────────────────────────────────────────────────────────────────

const FEE_PERCENT = process.env['ARGENS_FEE_PERCENT'] ?? '0.005'
const FEE_WALLET = process.env['ARGENS_FEE_WALLET']

if (!FEE_WALLET) {
  // Warn at startup — don't throw here because tests may not have .env loaded
  logger.warn('ARGENS_FEE_WALLET is not set — POST /pay will fail until it is configured')
}

// ─── Fee arithmetic ─────────────────────────────────────────────────────────

/**
 * Compute the 0.5% Argens fee.
 * Rounded DOWN to 7 decimal places — always favours the user.
 */
export function computeFee(amount: string): string {
  return new Decimal(amount)
    .mul(FEE_PERCENT)
    .toDecimalPlaces(7, Decimal.ROUND_DOWN)
    .toFixed(7)
}

/**
 * Total debited from the wallet: requested amount + fee.
 */
export function computeTotalDebited(amount: string): { fee: string; totalDebited: string } {
  const fee = computeFee(amount)
  const totalDebited = new Decimal(amount).plus(fee).toFixed(7)
  return { fee, totalDebited }
}

// ─── Payment submission ──────────────────────────────────────────────────────

export interface SubmitPaymentParams {
  senderSecretKey: string       // S... 56-char Stellar secret key (decrypted in memory)
  recipientPublicKey: string    // G... 56-char destination
  amount: string                // "25.0000000" — requested amount (not including fee)
  memo?: string | null          // max 28 bytes; truncated silently on construction
}

export interface SubmitPaymentResult {
  hash: string
  fee: string
  totalDebited: string
  ledger: number
}

/**
 * Build, sign, and submit the two-op atomic Stellar payment.
 *
 * Retries ONCE on failure before marking FAILED (per CLAUDE.md rule).
 * Any remaining error is wrapped in StellarError and re-thrown — callers
 * are responsible for logging to the transaction record.
 */
export async function submitPayment(
  params: SubmitPaymentParams,
): Promise<SubmitPaymentResult> {
  if (!FEE_WALLET) {
    throw new StellarError(
      'ARGENS_FEE_WALLET env var is not set — cannot process payments',
      'FEE_WALLET_NOT_CONFIGURED',
    )
  }

  const { fee, totalDebited } = computeTotalDebited(params.amount)

  const attempt = async (): Promise<SubmitPaymentResult> => {
    const keypair = Keypair.fromSecret(params.senderSecretKey)
    const server = new Horizon.Server(HORIZON_URL)

    const account = await server.loadAccount(keypair.publicKey())

    const builder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      // Op 1 — pay recipient the requested amount
      .addOperation(
        Operation.payment({
          destination: params.recipientPublicKey,
          asset: USDC_ASSET,
          amount: params.amount,
        }),
      )
      // Op 2 — pay Argens fee wallet (same atomic tx)
      .addOperation(
        Operation.payment({
          destination: FEE_WALLET,
          asset: USDC_ASSET,
          amount: fee,
        }),
      )
      .setTimeout(30)

    // Memo is optional; Stellar enforces ≤28 bytes at the network level
    if (params.memo) {
      // Truncate to 28 bytes to avoid network rejection
      const memoBytes = Buffer.from(params.memo, 'utf8').slice(0, 28)
      builder.addMemo(Memo.text(memoBytes.toString('utf8')))
    }

    const tx = builder.build()
    tx.sign(keypair)

    const result = await server.submitTransaction(tx)

    return {
      hash: result.hash,
      fee,
      totalDebited,
      ledger: (result as { ledger?: number }).ledger ?? 0,
    }
  }

  // First attempt
  try {
    return await attempt()
  } catch (firstErr) {
    const firstMsg = extractStellarError(firstErr)
    logger.warn('Stellar payment failed on first attempt — retrying once', {
      error: firstMsg,
      recipient: params.recipientPublicKey,
      amount: params.amount,
    })

    // Single retry
    try {
      return await attempt()
    } catch (secondErr) {
      const msg = extractStellarError(secondErr)
      logger.error('Stellar payment failed after retry', {
        error: msg,
        recipient: params.recipientPublicKey,
        amount: params.amount,
      })
      throw new StellarError(`Stellar submission failed: ${msg}`, 'STELLAR_SUBMISSION_FAILED')
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractStellarError(err: unknown): string {
  if (err && typeof err === 'object') {
    // Horizon error shape
    const e = err as Record<string, unknown>
    if (e['response'] && typeof e['response'] === 'object') {
      const resp = e['response'] as Record<string, unknown>
      if (resp['data']) {
        return JSON.stringify(resp['data'])
      }
    }
    if ('message' in e) return String(e['message'])
  }
  return String(err)
}
