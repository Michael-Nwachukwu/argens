/**
 * services/cctp.ts
 *
 * Stellar → EVM cross-chain USDC transfers via Circle CCTP V2.
 * V1 scope: Stellar → Base only.
 *
 * Flow: burn USDC on Stellar (Soroban TokenMessengerMinter contract) →
 *       poll Circle Iris API for attestation →
 *       relay receiveMessage on Base (EVM)
 */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Address,
  hash,
  contract as contractSdk,
  rpc as sorobanRpc,
  nativeToScVal,
  type Transaction,
} from '@stellar/stellar-sdk'
import { createWalletClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { Decimal } from '@prisma/client/runtime/library'
import { logger } from '../lib/logger.js'
import { AppError } from '../lib/errors.js'
import { getUsdcBalance } from './stellar.js'
import { withFeeSponsor } from './sponsorship.js'

// ─── Network config ────────────────────────────────────────────────────────────

const NETWORK = process.env['STELLAR_NETWORK'] === 'mainnet' ? 'mainnet' : 'testnet'

const NETWORK_PASSPHRASE = NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET

const SOROBAN_RPC_URL =
  process.env['SOROBAN_RPC_URL'] ??
  (NETWORK === 'mainnet' ? 'https://soroban.stellar.org' : 'https://soroban-testnet.stellar.org')

// ─── Contract addresses ────────────────────────────────────────────────────────

// Stellar TokenMessengerMinter — Stellar CCTP domain 27
const TOKEN_MESSENGER_MINTER =
  NETWORK === 'mainnet'
    ? 'CAE2G5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL'
    : 'CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP'

// USDC Stellar Asset Contract (SAC) — computed from USDC issuer key
const USDC_SAC =
  NETWORK === 'mainnet'
    ? 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75'
    : 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'

// Circle Iris attestation API
const IRIS_BASE_URL =
  NETWORK === 'mainnet' ? 'https://iris-api.circle.com' : 'https://iris-api-sandbox.circle.com'

// Base MessageTransmitter V2 — receives the attested message and mints USDC
const BASE_MESSAGE_TRANSMITTER =
  NETWORK === 'mainnet'
    ? '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64'
    : '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275'

// ─── CCTP domain IDs ──────────────────────────────────────────────────────────

export const STELLAR_DOMAIN = 27
export const BASE_DOMAIN = 6

// ─── Cross-chain fee (Argens revenue on CCTP transfers) ───────────────────────

export const CCTP_FEE_RATE = new Decimal('0.005') // 0.5%
export const CCTP_FEE_MIN  = new Decimal('0.01')  // $0.01 floor
export const CCTP_FEE_MAX  = new Decimal('2.00')  // $2.00 ceiling

/**
 * Returns the Argens fee for a CCTP cross-chain transfer of `amount` USDC.
 * Hybrid model: `clamp(amount * 0.005, 0.01, 2.00)`.
 * Result is a Stellar-formatted amount string (7 decimals).
 */
export function computeCctpFee(amount: string): string {
  const raw = new Decimal(amount).mul(CCTP_FEE_RATE)
  const clamped = Decimal.min(Decimal.max(raw, CCTP_FEE_MIN), CCTP_FEE_MAX)
  return clamped.toFixed(7)
}

export interface CctpPreflightResult {
  amount: string
  argens_fee: string
  required_total: string
  available: string
}

/**
 * CCTP is not atomic in Argens V1: the Argens fee is a Stellar payment and the
 * CCTP burn is a separate Soroban call. This preflight must run before the fee
 * transfer so we do not take a fee from a wallet that cannot fund amount + fee.
 */
export async function verifyCctpPreflightBalance(
  walletPublicKey: string,
  amount: string,
  feeAmount: string,
): Promise<CctpPreflightResult> {
  const requiredTotal = new Decimal(amount).plus(feeAmount)

  let liveUsdcBalance: string | null
  try {
    liveUsdcBalance = await getUsdcBalance(walletPublicKey)
  } catch (e) {
    throw new AppError(
      'Could not verify wallet balance before cross-chain payment. No fee was taken.',
      'CCTP_PREFLIGHT_UNAVAILABLE',
      503,
      {
        amount,
        argens_fee: feeAmount,
        required_total: requiredTotal.toFixed(7),
        wallet_public_key: walletPublicKey,
        verification_error: e instanceof Error ? e.message : String(e),
      },
    )
  }

  if (liveUsdcBalance === null) {
    throw new AppError(
      'Could not verify wallet balance before cross-chain payment. No fee was taken.',
      'CCTP_PREFLIGHT_UNAVAILABLE',
      503,
      {
        amount,
        argens_fee: feeAmount,
        required_total: requiredTotal.toFixed(7),
        wallet_public_key: walletPublicKey,
        verification_error: 'Wallet account was not found on the active Stellar network.',
      },
    )
  }

  const liveBal = new Decimal(liveUsdcBalance)
  if (liveBal.lessThan(requiredTotal)) {
    throw new AppError(
      `Insufficient USDC. Cross-chain transfers require amount + Argens fee. Need ${requiredTotal.toFixed(7)} USDC; wallet has ${liveBal.toFixed(7)}.`,
      'INSUFFICIENT_FUNDS_PLUS_FEES',
      402,
      {
        amount,
        argens_fee: feeAmount,
        required_total: requiredTotal.toFixed(7),
        available: liveBal.toFixed(7),
      },
    )
  }

  return {
    amount,
    argens_fee: feeAmount,
    required_total: requiredTotal.toFixed(7),
    available: liveBal.toFixed(7),
  }
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class CctpError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CCTP_ERROR', 500, details)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the EVM address encoded as a 32-byte Buffer (left-zero-padded).
 * This is the mint_recipient format the CCTP Soroban contract expects.
 */
export function encodeEvmRecipient(evmAddress: string): Buffer {
  if (!evmAddress.startsWith('0x') || evmAddress.length !== 42) {
    throw new CctpError(`Invalid EVM address: ${evmAddress}`)
  }
  return Buffer.concat([Buffer.alloc(12), Buffer.from(evmAddress.slice(2), 'hex')])
}

/** Converts "25.0000000" → "250000000" (I128 base units, 7 decimals). */
function amountToI128(amountStr: string): string {
  const parts = amountStr.split('.')
  const whole = parts[0] ?? '0'
  const frac = parts[1] ?? ''
  const fracPadded = frac.padEnd(7, '0').slice(0, 7)
  return (BigInt(whole) * 10_000_000n + BigInt(fracPadded)).toString()
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Inlined equivalent of @stellar/stellar-sdk/contract basicNodeSigner. */
function makeNodeSigner(keypair: Keypair, networkPassphrase: string) {
  return {
    signTransaction: async (xdr: string, opts?: { networkPassphrase?: string }) => {
      const tx = TransactionBuilder.fromXDR(xdr, opts?.networkPassphrase ?? networkPassphrase)
      tx.sign(keypair)
      return { signedTxXdr: tx.toXDR(), signerAddress: keypair.publicKey() }
    },
    signAuthEntry: async (authEntry: string) => ({
      signedAuthEntry: keypair.sign(hash(Buffer.from(authEntry, 'base64'))).toString('base64'),
      signerAddress: keypair.publicKey(),
    }),
  }
}

/**
 * Submit a signed, user-sourced Soroban transaction inside an ops-paid fee-bump and wait
 * for it to land. User wallets hold no XLM, so they cannot pay Soroban fees themselves;
 * the fee-bump carries the inner resource fee (see services/sponsorship.ts).
 *
 * Polls until SUCCESS / FAILED or until the transaction's validity window has closed —
 * after `maxTime` it can no longer be included, so a timeout here means it did not land.
 * Transient RPC errors while polling are tolerated: once submitted, giving up early would
 * misreport a transaction that may still succeed (fatal for a burn).
 */
async function sendSponsoredSoroban(
  rpcServer: sorobanRpc.Server,
  signedInnerTx: Transaction,
  label: string,
): Promise<string> {
  const sent = await rpcServer.sendTransaction(withFeeSponsor(signedInnerTx))
  if (sent.status !== 'PENDING' && sent.status !== 'DUPLICATE') {
    throw new CctpError(`${label} submission failed`, {
      status: sent.status,
      errorResult: String(sent.errorResult),
    })
  }

  logger.info(`${label} submitted`, { hash: sent.hash })

  const maxTime = Number(signedInnerTx.timeBounds?.maxTime ?? 0)
  const deadline = maxTime > 0 ? (maxTime + 15) * 1000 : Date.now() + 60_000
  while (Date.now() < deadline) {
    await sleep(2000)
    let result: sorobanRpc.Api.GetTransactionResponse
    try {
      result = await rpcServer.getTransaction(sent.hash)
    } catch (pollErr) {
      logger.warn(`${label} status poll failed — retrying`, {
        hash: sent.hash,
        error: pollErr instanceof Error ? pollErr.message : String(pollErr),
      })
      continue
    }
    if (result.status === sorobanRpc.Api.GetTransactionStatus.SUCCESS) return sent.hash
    if (result.status === sorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new CctpError(`${label} tx failed on-chain`, {
        hash: sent.hash,
        resultXdr: String(result.resultXdr),
      })
    }
  }

  throw new CctpError(`${label} tx timed out waiting for confirmation`, { hash: sent.hash })
}

// ─── Step 0 — Approve TokenMessengerMinter allowance ─────────────────────────

/**
 * Approves the TokenMessengerMinter contract to spend `amountI128` USDC from
 * the wallet via transfer_from. The USDC SAC has no on-chain contract spec, so
 * we build and submit the transaction manually with invokeContractFunction.
 */
// Inclusion fee (stroops) bid for the Soroban approve. BASE_FEE (100 stroops)
// loses the fee auction under any mempool contention, so the tx sits unincluded
// until its validity window expires and validators drop it (observed in prod
// 2026-06-16). 0.01 XLM is a strong inclusion bid; assembleTransaction adds the
// resource fee on top. Stellar only charges the effective fee, not the full bid.
const SOROBAN_APPROVE_INCLUSION_FEE = '100000' // 0.01 XLM

async function approveUsdcSpend(keypair: Keypair, amountI128: string): Promise<void> {
  const rpcServer = new sorobanRpc.Server(SOROBAN_RPC_URL)

  // A submitted-but-unincluded approve is the dominant failure mode. Rebuild
  // with a fresh validity window and resubmit once before giving up.
  const MAX_ATTEMPTS = 2
  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await submitApproveOnce(rpcServer, keypair, amountI128)
      return
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      logger.warn('USDC approve attempt failed', { attempt, maxAttempts: MAX_ATTEMPTS, error: lastErr.message })
      if (attempt < MAX_ATTEMPTS) await sleep(2000)
    }
  }
  throw lastErr ?? new CctpError('USDC approve failed')
}

async function submitApproveOnce(
  rpcServer: sorobanRpc.Server,
  keypair: Keypair,
  amountI128: string,
): Promise<void> {
  const latestLedger = await rpcServer.getLatestLedger()
  const expirationLedger = latestLedger.sequence + 100_000

  const sourceAccount = await rpcServer.getAccount(keypair.publicKey())

  const approveOp = Operation.invokeContractFunction({
    contract: USDC_SAC,
    function: 'approve',
    args: [
      new Address(keypair.publicKey()).toScVal(),
      new Address(TOKEN_MESSENGER_MINTER).toScVal(),
      nativeToScVal(BigInt(amountI128), { type: 'i128' }),
      nativeToScVal(expirationLedger, { type: 'u32' }),
    ],
  })

  const tx = new TransactionBuilder(sourceAccount, {
    fee: SOROBAN_APPROVE_INCLUSION_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(approveOp)
    .setTimeout(60)
    .build()

  const simResult = await rpcServer.simulateTransaction(tx)
  if (sorobanRpc.Api.isSimulationError(simResult)) {
    throw new CctpError(`USDC approve simulation failed: ${simResult.error}`)
  }

  const assembled = sorobanRpc.assembleTransaction(tx, simResult).build()
  assembled.sign(keypair)

  const approveHash = await sendSponsoredSoroban(rpcServer, assembled, 'USDC approve')
  logger.info('USDC allowance approved', { hash: approveHash, amount: amountI128, expirationLedger })
}

// ─── Step 1 — Burn USDC on Stellar via Soroban ────────────────────────────────

/**
 * Calls TokenMessengerMinter.deposit_for_burn on Stellar.
 *
 * Burns `amountStr` USDC from the caller's wallet and emits a cross-chain message
 * for the specified destination domain. Returns the Stellar tx hash.
 */
export async function burnUsdcOnStellar(
  secretKey: string,
  amountStr: string,
  destinationDomain: number,
  mintRecipient32: Buffer,
): Promise<{ stellarTxHash: string }> {
  const keypair = Keypair.fromSecret(secretKey)
  const { signTransaction, signAuthEntry } = makeNodeSigner(keypair, NETWORK_PASSPHRASE)

  // Client.from() fetches the contract spec from the network and auto-generates
  // typed method wrappers — deposit_for_burn is added dynamically at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = await contractSdk.Client.from({
    contractId: TOKEN_MESSENGER_MINTER,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: SOROBAN_RPC_URL,
    publicKey: keypair.publicKey(),
    signTransaction,
    signAuthEntry,
  })

  // Query the minimum fee the contract requires for this token
  let maxFee = '0'
  const amountI128 = amountToI128(amountStr)
  try {
    const feeRes = await client.get_min_fee_amount({ burn_token: USDC_SAC, amount: amountI128 })
    maxFee = (feeRes.result ?? 0n).toString()
    logger.info('CCTP min fee', { maxFee })
  } catch (feeErr) {
    logger.warn('Could not fetch CCTP min fee, proceeding with 0', {
      error: feeErr instanceof Error ? feeErr.message : String(feeErr),
    })
  }

  // Step 0: approve the TokenMessengerMinter to pull USDC via transfer_from.
  // The USDC SAC is a system contract with no on-chain spec, so we build the
  // approve tx manually with invokeContractFunction rather than Client.from().
  await approveUsdcSpend(keypair, amountI128)

  logger.info('Calling deposit_for_burn', {
    amount: amountI128,
    destinationDomain,
    maxFee,
    burnToken: USDC_SAC,
  })

  let tx: any
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx = await client.deposit_for_burn({
      caller: keypair.publicKey(),
      amount: amountI128,
      destination_domain: destinationDomain,
      mint_recipient: mintRecipient32,
      burn_token: USDC_SAC,
      destination_caller: Buffer.alloc(32), // zero = any relayer can call receiveMessage
      max_fee: maxFee,
      min_finality_threshold: 500, // 500 = Fast Transfer (~8–20 sec)
    })
  } catch (buildErr) {
    throw new CctpError(
      `deposit_for_burn call failed: ${buildErr instanceof Error ? buildErr.message : String(buildErr)}`,
      { raw: String(buildErr) },
    )
  }

  // Sign the simulated transaction, then submit it inside an ops-paid fee-bump rather than
  // via signAndSend(), which would make the 0-XLM user wallet pay the fee itself.
  let signedBurn: Transaction
  try {
    await tx.sign()
    signedBurn = tx.signed
  } catch (signErr) {
    throw new CctpError(
      `deposit_for_burn signing failed: ${signErr instanceof Error ? signErr.message : String(signErr)}`,
      { raw: String(signErr) },
    )
  }

  const hash = await sendSponsoredSoroban(
    new sorobanRpc.Server(SOROBAN_RPC_URL),
    signedBurn,
    'CCTP burn',
  )

  logger.info('CCTP burn on Stellar complete', { hash, amount: amountStr, destinationDomain })
  return { stellarTxHash: hash }
}

// ─── Step 2 — Poll Circle Iris for attestation ────────────────────────────────

interface IrisMessage {
  status: string
  message: string
  attestation: string
}

/**
 * Polls Circle's Iris API until the Stellar burn is attested.
 * Fast Transfer attests in ~8–20 seconds. Polls every 5s, times out at 5 min.
 */
export async function pollAttestation(
  stellarTxHash: string,
): Promise<{ message: string; attestation: string }> {
  const url = `${IRIS_BASE_URL}/v2/messages/${STELLAR_DOMAIN}?transactionHash=${stellarTxHash}`
  const maxAttempts = 60 // 60 × 5s = 5 min

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(5000)

    let data: { messages?: IrisMessage[] }
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) {
        logger.warn('Iris poll returned non-200', { status: res.status, attempt })
        continue
      }
      data = (await res.json()) as { messages?: IrisMessage[] }
    } catch (e) {
      logger.warn('Iris poll fetch failed', { attempt, error: (e as Error).message })
      continue
    }

    const msg = data.messages?.[0]
    if (msg?.status === 'complete' && msg.attestation && msg.attestation !== '0x') {
      logger.info('CCTP attestation complete', { stellarTxHash, attempt })
      return { message: msg.message, attestation: msg.attestation }
    }

    logger.debug('Awaiting CCTP attestation', { stellarTxHash, attempt, status: msg?.status ?? 'no message' })
  }

  throw new CctpError('CCTP attestation timed out after 5 minutes', { stellarTxHash })
}

// ─── Step 3 — Relay receiveMessage on Base ────────────────────────────────────

const MESSAGE_TRANSMITTER_ABI = [
  {
    name: 'receiveMessage',
    type: 'function' as const,
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

/**
 * Submits receiveMessage to Base's MessageTransmitter V2, minting USDC on Base.
 * Requires ARGENS_BASE_RELAYER_SECRET env var (EVM private key, no 0x prefix).
 *
 * Returns the Base transaction hash.
 */
export async function relayOnBase(
  message: string,
  attestation: string,
): Promise<{ baseTxHash: string }> {
  const relayerSecret = process.env['ARGENS_BASE_RELAYER_SECRET']
  const rpcUrl =
    NETWORK === 'mainnet'
      ? (process.env['BASE_RPC_URL'] ?? 'https://mainnet.base.org')
      : (process.env['BASE_TESTNET_RPC_URL'] ?? 'https://sepolia.base.org')

  if (!relayerSecret) {
    throw new CctpError('ARGENS_BASE_RELAYER_SECRET is not configured — cannot relay on Base')
  }

  const keyHex = relayerSecret.startsWith('0x') ? relayerSecret : `0x${relayerSecret}`
  const account = privateKeyToAccount(keyHex as `0x${string}`)
  const walletClient = createWalletClient({
    account,
    chain: NETWORK === 'mainnet' ? base : baseSepolia,
    transport: http(rpcUrl),
  })

  try {
    const hash = await walletClient.writeContract({
      address: BASE_MESSAGE_TRANSMITTER as `0x${string}`,
      abi: MESSAGE_TRANSMITTER_ABI,
      functionName: 'receiveMessage',
      args: [message as `0x${string}`, attestation as `0x${string}`],
    })
    logger.info('CCTP relay on Base complete', { hash })
    return { baseTxHash: hash }
  } catch (e) {
    throw new CctpError('Base relay transaction failed', { error: (e as Error).message })
  }
}
