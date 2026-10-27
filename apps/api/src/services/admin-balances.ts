/**
 * services/admin-balances.ts
 *
 * Read-only balance aggregator for the admin dashboard. Returns USDC + XLM for
 * the three Argens-operated Stellar wallets (ops, fee, credit-pool), plus the
 * Base relayer's ETH balance for CCTP relay gas. All reads are best-effort;
 * any individual wallet that errors returns null so the dashboard can still
 * render the others.
 *
 * `readBaseRelayer` is also the ETH reader used by services/alerting.ts —
 * do not add a second implementation there.
 */

import { createPublicClient, formatEther, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { USDC_ASSET, server } from './stellar.js'
import { spendableXlm } from './sponsorship.js'
import { logger } from '../lib/logger.js'
import type { AppError } from '../lib/errors.js'

const NETWORK = process.env['STELLAR_NETWORK'] === 'mainnet' ? 'mainnet' : 'testnet'

export interface StellarWalletStatus {
  label: string
  envKey: string
  public_key: string | null
  usdc: string | null
  xlm: string | null
  /** XLM above the account's minimum balance. For the ops wallet, sponsored user reserves
   *  inflate `xlm` but can never be spent — this is the number that runs out. */
  xlm_spendable: string | null
  configured: boolean
  error?: string | null
}

export interface BaseRelayerStatus {
  label: string
  configured: boolean
  address: string | null
  eth: string | null
  chain: 'base' | 'base-sepolia'
  error?: string | null
}

export interface WalletBalancesReport {
  network: 'mainnet' | 'testnet'
  stellar: StellarWalletStatus[]
  base_relayer: BaseRelayerStatus
}

async function readStellarWallet(
  label: string,
  envKey: string,
  publicKey: string | undefined,
): Promise<StellarWalletStatus> {
  if (!publicKey) {
    return { label, envKey, public_key: null, usdc: null, xlm: null, xlm_spendable: null, configured: false }
  }
  try {
    const account = await server.loadAccount(publicKey)
    const native = account.balances.find((b) => b.asset_type === 'native')
    const usdc = account.balances.find(
      (b) =>
        b.asset_type === 'credit_alphanum4' &&
        b.asset_code === USDC_ASSET.code &&
        b.asset_issuer === USDC_ASSET.issuer,
    )

    return {
      label,
      envKey,
      public_key: publicKey,
      usdc: usdc?.balance ?? '0.0000000',
      xlm: native?.balance ?? '0.0000000',
      xlm_spendable: spendableXlm(account),
      configured: true,
      error: null,
    }
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status
    if (status === 404) {
      return {
        label,
        envKey,
        public_key: publicKey,
        usdc: null,
        xlm: null,
        xlm_spendable: null,
        configured: true,
        error: 'Account not found on the active Stellar network.',
      }
    }

    const msg = errorMessage(e)
    logger.warn('admin-balances: Stellar account read failed', { envKey, publicKey, error: msg })
    return {
      label,
      envKey,
      public_key: publicKey,
      usdc: null,
      xlm: null,
      xlm_spendable: null,
      configured: true,
      error: msg,
    }
  }
}

export async function readBaseRelayer(): Promise<BaseRelayerStatus> {
  const relayerSecret = process.env['ARGENS_BASE_RELAYER_SECRET']
  const chain = NETWORK === 'mainnet' ? base : baseSepolia
  const chainLabel: 'base' | 'base-sepolia' = NETWORK === 'mainnet' ? 'base' : 'base-sepolia'
  const label = 'CCTP relayer (Base)'

  if (!relayerSecret) {
    return { label, configured: false, address: null, eth: null, chain: chainLabel }
  }

  try {
    const normalized = (relayerSecret.startsWith('0x') ? relayerSecret : `0x${relayerSecret}`) as `0x${string}`
    const account = privateKeyToAccount(normalized)
    const rpcUrl = NETWORK === 'mainnet'
      ? (process.env['BASE_RPC_URL'] ?? 'https://mainnet.base.org')
      : (process.env['BASE_TESTNET_RPC_URL'] ?? 'https://sepolia.base.org')
    const client = createPublicClient({ chain, transport: http(rpcUrl) })
    const wei = await client.getBalance({ address: account.address })
    const eth = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 7,
      maximumFractionDigits: 7,
      useGrouping: false,
    }).format(Number(formatEther(wei)))
    return { label, configured: true, address: account.address, eth, chain: chainLabel, error: null }
  } catch (e) {
    const msg = errorMessage(e)
    logger.warn('Failed to read Base relayer balance', { error: msg })
    return { label, configured: true, address: null, eth: null, chain: chainLabel, error: msg }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const appError = error as AppError
    const details = appError.details
    if (details && typeof details === 'object') {
      const detailError = (details as Record<string, unknown>)['error']
      if (typeof detailError === 'string' && detailError.length > 0) {
        return `${error.message}: ${detailError}`
      }
    }
    return error.message
  }
  return String(error)
}

export async function getWalletBalancesReport(): Promise<WalletBalancesReport> {
  const [ops, fee, pool, relayer] = await Promise.all([
    readStellarWallet('Ops wallet (XLM funder)',     'ARGENS_OPS_WALLET_PUBLIC',  process.env['ARGENS_OPS_WALLET_PUBLIC']),
    readStellarWallet('Fee wallet (USDC revenue)',   'ARGENS_FEE_WALLET',         process.env['ARGENS_FEE_WALLET']),
    readStellarWallet('Credit pool (granted USDC)',  'ARGENS_CREDIT_POOL_PUBLIC', process.env['ARGENS_CREDIT_POOL_PUBLIC']),
    readBaseRelayer(),
  ])
  return {
    network: NETWORK as 'mainnet' | 'testnet',
    stellar: [ops, fee, pool],
    base_relayer: relayer,
  }
}
