/**
 * services/payment.ts
 *
 * Stellar payment execution for Argens.
 *
 * Every direct payment is a single-operation Stellar transaction:
 *   Op 1 → recipient (requested amount)
 *
 * Argens charges zero fee on direct payments. Revenue comes exclusively
 * from marketplace API markup. See CLAUDE.md — Key Decisions.
 *
 * The network fee is paid by the ops wallet: the user signs the payment and it is
 * submitted inside a fee-bump (services/sponsorship.ts). User wallets created after
 * reserve sponsorship hold 0 XLM and could not pay it themselves.
 *
 * Amount handling:
 *   - All amounts are STRING "25.0000000" — never JS numbers
 *   - Stellar SDK accepts and returns string amounts
 */

import {
  Keypair,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Memo,
} from '@stellar/stellar-sdk'
import { NETWORK_PASSPHRASE, USDC_ASSET, server } from './stellar.js'
import { submitClassic } from './sponsorship.js'
import { StellarError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

// ─── Payment submission ──────────────────────────────────────────────────────

export interface SubmitPaymentParams {
  senderSecretKey: string       // S... 56-char Stellar secret key (decrypted in memory)
  recipientPublicKey: string    // G... 56-char destination
  amount: string                // "25.0000000" — string, 7 decimals
  memo?: string | null          // max 28 bytes
}

export interface SubmitPaymentResult {
  hash: string
  ledger: number
}

/**
 * Build, sign, and submit a single-operation Stellar USDC payment, fee paid by the ops wallet.
 *
 * Retries ONCE on failure before marking FAILED (per CLAUDE.md rule).
 * Any remaining error is wrapped in StellarError and re-thrown.
 */
export async function submitPayment(
  params: SubmitPaymentParams,
): Promise<SubmitPaymentResult> {
  const attempt = async (): Promise<SubmitPaymentResult> => {
    const keypair = Keypair.fromSecret(params.senderSecretKey)
    const account = await server.loadAccount(keypair.publicKey())

    const builder = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: params.recipientPublicKey,
          asset: USDC_ASSET,
          amount: params.amount,
        }),
      )
      .setTimeout(30)

    if (params.memo) {
      const memoBytes = Buffer.from(params.memo, 'utf8').slice(0, 28)
      builder.addMemo(Memo.text(memoBytes.toString('utf8')))
    }

    const tx = builder.build()
    tx.sign(keypair)

    // Ops wallet pays the fee via fee-bump; `result.hash` is the fee-bump hash, which
    // explorers resolve to the enclosed payment.
    const result = await submitClassic(tx)

    return {
      hash: result.hash,
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
    const e = err as Record<string, unknown>
    if (e['response'] && typeof e['response'] === 'object') {
      const resp = e['response'] as Record<string, unknown>
      if (resp['data']) return JSON.stringify(resp['data'])
    }
    if ('message' in e) return String(e['message'])
  }
  return String(err)
}
