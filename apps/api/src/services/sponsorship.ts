/**
 * services/sponsorship.ts
 *
 * Argens pays the XLM costs of user wallets so that new user accounts hold 0 XLM.
 *
 *   Reserves (CAP-33) — the ops wallet sponsors each user account's base reserve and its
 *   USDC trustline reserve. The XLM never leaves the ops wallet: it is locked there as the
 *   ops account's own reserve, cannot be withdrawn by the user, and is released back to ops
 *   if the sponsored account or trustline is ever removed.
 *
 *   Fees (CAP-15) — every transaction a user wallet signs is wrapped in a fee-bump whose fee
 *   source is the ops wallet. The inner transaction keeps the user as its source and uses the
 *   user's sequence number, so fee-bumps never consume or contend on the ops sequence.
 *
 * Every user-signed submission must go through withFeeSponsor(). A path that skips it keeps
 * working for wallets created before sponsorship (they were gifted 2.0 XLM) and fails only for
 * new 0-XLM wallets — which is exactly the kind of bug that passes testing.
 *
 * Marketplace x402 payments (services/mpp-client.ts) are the one exception and need nothing
 * here: the user signs only a Soroban auth entry, and MPP's facilitator builds the transaction
 * and pays its fee (`areFeesSponsored` is mandatory in @x402/stellar).
 */

import {
  Keypair,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  xdr,
  type Account,
  type FeeBumpTransaction,
  type Horizon,
  type Transaction,
} from '@stellar/stellar-sdk'
import { Decimal } from '@prisma/client/runtime/library'
import { NETWORK, NETWORK_PASSPHRASE, USDC_ASSET, server } from './stellar.js'
import { StellarError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'

// Stellar network base reserve. A protocol parameter that has been 0.5 XLM since 2019;
// see CLAUDE.md Rule 5 ("1 XLM base + 0.5 XLM per trustline").
const BASE_RESERVE_XLM = new Decimal('0.5')

/**
 * XLM the ops wallet locks per sponsored user wallet: 2 base reserves for the account plus
 * 1 for the USDC trustline. This is the sponsor's minimum-balance increase, not a transfer.
 */
export const SPONSORED_RESERVE_PER_WALLET_XLM = BASE_RESERVE_XLM.mul(3).toFixed(7)

// ─── Fee sponsor ──────────────────────────────────────────────────────────────

/**
 * The ops wallet doubles as the fee sponsor. Required on mainnet, where new wallets hold no
 * XLM and cannot pay their own fees. On testnet it is optional: without it, wallets are
 * funded by friendbot and pay their own fees, so the sponsored path is not exercised.
 */
export function getFeeSponsorKeypair(): Keypair | null {
  const secret = process.env['ARGENS_OPS_WALLET_SECRET']
  if (!secret) {
    if (NETWORK === 'mainnet') {
      throw new StellarError(
        'ARGENS_OPS_WALLET_SECRET is not set — mainnet user wallets hold no XLM and cannot transact without a fee sponsor',
      )
    }
    return null
  }
  return Keypair.fromSecret(secret)
}

/**
 * The inclusion-fee rate (stroops per operation) of an inner transaction, excluding any
 * Soroban resource fee. A fee-bump must bid at least this rate, and at least BASE_FEE.
 * Mirrors the check in stellar-base's TransactionBuilder.buildFeeBumpTransaction.
 */
export function innerInclusionFeeRate(innerTx: Transaction): string {
  const sorobanData = innerTx.toEnvelope().v1().tx().ext().value() as xdr.SorobanTransactionData | undefined
  const resourceFee = new Decimal(sorobanData ? sorobanData.resourceFee().toString() : '0')
  const rate = new Decimal(innerTx.fee).minus(resourceFee).div(innerTx.operations.length).ceil()
  return Decimal.max(rate, new Decimal(BASE_FEE)).toFixed(0)
}

/**
 * Wrap an already-signed, user-sourced transaction in a fee-bump paid by the ops wallet.
 *
 * The inner transaction must carry the user's signature before it is wrapped. Returns the
 * inner transaction unchanged when no sponsor is configured (testnet without an ops key).
 * For Soroban transactions the inner resource fee is carried into the outer fee by the SDK.
 */
export function withFeeSponsor(innerTx: Transaction): Transaction | FeeBumpTransaction {
  const sponsor = getFeeSponsorKeypair()
  if (!sponsor) return innerTx

  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    sponsor,
    innerInclusionFeeRate(innerTx),
    innerTx,
    NETWORK_PASSPHRASE,
  )
  feeBump.sign(sponsor)
  return feeBump
}

/** Submit a signed, user-sourced classic transaction to Horizon with the ops wallet paying the fee. */
export async function submitClassic(
  innerTx: Transaction,
): Promise<Horizon.HorizonApi.SubmitTransactionResponse> {
  return server.submitTransaction(withFeeSponsor(innerTx))
}

// ─── Account activation ───────────────────────────────────────────────────────

export type AccountState = 'missing' | 'no_trustline' | 'ready'

/** Where a wallet's on-chain setup stands. Drives activation and its recovery paths. */
export async function inspectAccount(publicKey: string): Promise<AccountState> {
  try {
    const account = await server.loadAccount(publicKey)
    const hasTrustline = account.balances.some(
      (b) =>
        b.asset_type === 'credit_alphanum4' &&
        b.asset_code === USDC_ASSET.code &&
        b.asset_issuer === USDC_ASSET.issuer,
    )
    return hasTrustline ? 'ready' : 'no_trustline'
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status
    if (status === 404) return 'missing'
    throw new StellarError('Failed to read account state', { publicKey, error: (e as Error).message })
  }
}

/**
 * One atomic transaction, sourced and fee-paid by the ops wallet, that creates the user
 * account with a 0 XLM balance and opens its USDC trustline — both reserves sponsored.
 * Signed by the ops wallet (source, sponsor) and the user (changeTrust + end sponsoring).
 */
export function buildSponsoredActivationTx(
  opsAccount: Account,
  sponsor: Keypair,
  user: Keypair,
): Transaction {
  const tx = new TransactionBuilder(opsAccount, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: user.publicKey() }))
    .addOperation(Operation.createAccount({ destination: user.publicKey(), startingBalance: '0' }))
    .addOperation(Operation.changeTrust({ asset: USDC_ASSET, source: user.publicKey() }))
    .addOperation(Operation.endSponsoringFutureReserves({ source: user.publicKey() }))
    .setTimeout(60)
    .build()
  tx.sign(sponsor, user)
  return tx
}

/**
 * For an account that already exists without a USDC trustline: open the trustline with its
 * reserve sponsored by the ops wallet. Covers wallets whose pre-sponsorship bootstrap stopped
 * between funding and trustline (TRUSTLINE_PENDING), whatever XLM they happen to hold.
 */
export function buildSponsoredTrustlineTx(
  opsAccount: Account,
  sponsor: Keypair,
  user: Keypair,
): Transaction {
  const tx = new TransactionBuilder(opsAccount, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: user.publicKey() }))
    .addOperation(Operation.changeTrust({ asset: USDC_ASSET, source: user.publicKey() }))
    .addOperation(Operation.endSponsoringFutureReserves({ source: user.publicKey() }))
    .setTimeout(60)
    .build()
  tx.sign(sponsor, user)
  return tx
}

/**
 * Bring a wallet to `ready` — account exists with a USDC trustline. Idempotent: it reads the
 * chain first and does only the missing work, so the same call serves signup and every retry.
 */
export async function activateAccount(userSecretKey: string): Promise<void> {
  const user = Keypair.fromSecret(userSecretKey)
  const publicKey = user.publicKey()

  const state = await inspectAccount(publicKey)
  if (state === 'ready') return

  const sponsor = getFeeSponsorKeypair()
  if (!sponsor) {
    await activateViaFriendbot(user, state)
    return
  }

  try {
    const opsAccount = await server.loadAccount(sponsor.publicKey())
    const tx =
      state === 'missing'
        ? buildSponsoredActivationTx(opsAccount, sponsor, user)
        : buildSponsoredTrustlineTx(opsAccount, sponsor, user)
    await server.submitTransaction(tx)
    logger.info('Wallet activated with sponsored reserves', { publicKey, from: state })
  } catch (e) {
    throw new StellarError('Sponsored wallet activation failed', {
      publicKey,
      from: state,
      error: extractHorizonError(e),
    })
  }
}

/** Testnet without an ops key: friendbot funds the account, which then pays its own trustline. */
async function activateViaFriendbot(user: Keypair, state: Exclude<AccountState, 'ready'>): Promise<void> {
  const publicKey = user.publicKey()
  if (state === 'missing') {
    const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`)
    if (!res.ok) {
      throw new StellarError('Friendbot funding failed', { publicKey, body: await res.text() })
    }
  }
  try {
    const account = await server.loadAccount(publicKey)
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
      .addOperation(Operation.changeTrust({ asset: USDC_ASSET }))
      .setTimeout(60)
      .build()
    tx.sign(user)
    await server.submitTransaction(tx)
    logger.info('Wallet activated via friendbot (unsponsored, testnet)', { publicKey })
  } catch (e) {
    throw new StellarError('USDC trustline creation failed', { publicKey, error: extractHorizonError(e) })
  }
}

// ─── Ops wallet health ────────────────────────────────────────────────────────

type ReserveFields = Pick<
  Horizon.AccountResponse,
  'balances' | 'subentry_count' | 'num_sponsoring' | 'num_sponsored'
>

/**
 * XLM an account can actually spend: balance minus its minimum balance minus selling
 * liabilities. For the ops wallet this is the number that matters — every sponsored wallet
 * raises its minimum balance by 1.5 XLM, so the raw balance overstates what is available
 * to pay fees and sponsor new signups.
 */
export function spendableXlm(account: ReserveFields): string {
  const native = account.balances.find((b) => b.asset_type === 'native')
  if (!native) return '0.0000000'

  const reserveUnits =
    2 + account.subentry_count + (account.num_sponsoring ?? 0) - (account.num_sponsored ?? 0)
  const minimumBalance = BASE_RESERVE_XLM.mul(reserveUnits)
  const liabilities = new Decimal(
    'selling_liabilities' in native && native.selling_liabilities ? native.selling_liabilities : '0',
  )
  const spendable = new Decimal(native.balance).minus(minimumBalance).minus(liabilities)
  return Decimal.max(spendable, 0).toFixed(7)
}

/** Spendable XLM for an address, or null when the account does not exist on this network. */
export async function getSpendableXlm(publicKey: string): Promise<string | null> {
  try {
    return spendableXlm(await server.loadAccount(publicKey))
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status
    if (status === 404) return null
    throw new StellarError('Failed to read spendable XLM', { publicKey, error: (e as Error).message })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractHorizonError(err: unknown): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (data) return JSON.stringify(data)
  return err instanceof Error ? err.message : String(err)
}
