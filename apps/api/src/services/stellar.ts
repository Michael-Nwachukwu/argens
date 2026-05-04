import {
  Horizon,
  Networks,
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  BASE_FEE,
} from '@stellar/stellar-sdk'
import { logger } from '../lib/logger.js'
import { StellarError } from '../lib/errors.js'

// ─── Network config ────────────────────────────────────────────────────────────
const NETWORK = process.env['STELLAR_NETWORK'] === 'mainnet' ? 'mainnet' : 'testnet'

const HORIZON_URL =
  NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org'

const NETWORK_PASSPHRASE =
  NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET

// ⚠️ VERIFY these against Circle's published list before mainnet deployment.
const USDC_ISSUER =
  NETWORK === 'mainnet'
    ? 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    : 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

export const USDC_ASSET = new Asset('USDC', USDC_ISSUER)
export const server = new Horizon.Server(HORIZON_URL)

// ─── Wallet creation ───────────────────────────────────────────────────────────
export function createStellarWallet(): { publicKey: string; secretKey: string } {
  const keypair = Keypair.random()
  return {
    publicKey: keypair.publicKey(),  // G..., 56 chars
    secretKey: keypair.secret(),     // S..., 56 chars — encrypt before storing
  }
}

// ─── Account funding ───────────────────────────────────────────────────────────
/**
 * On testnet: fund via friendbot (free 10,000 XLM).
 * On mainnet: fund from ops wallet (1.5 XLM reserve).
 */
export async function fundNewAccount(publicKey: string): Promise<void> {
  if (NETWORK === 'testnet') {
    const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`)
    if (!res.ok) {
      const body = await res.text()
      throw new StellarError('Friendbot funding failed', { publicKey, body })
    }
    logger.info('Friendbot funded new account', { publicKey })
    return
  }

  // Mainnet: use ops wallet to send 1.5 XLM via createAccount operation.
  const opsSecret = process.env['ARGENS_OPS_WALLET_SECRET']
  if (!opsSecret) throw new StellarError('ARGENS_OPS_WALLET_SECRET not set — cannot fund mainnet accounts')

  const opsKeypair = Keypair.fromSecret(opsSecret)
  try {
    const opsAccount = await server.loadAccount(opsKeypair.publicKey())
    const tx = new TransactionBuilder(opsAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.createAccount({
          destination: publicKey,
          startingBalance: '1.5000000', // 1 XLM base reserve + 0.5 XLM trustline reserve
        }),
      )
      .setTimeout(30)
      .build()
    tx.sign(opsKeypair)
    await server.submitTransaction(tx)
    logger.info('Ops wallet funded new account', { publicKey })
  } catch (e) {
    throw new StellarError('Ops wallet funding failed', { publicKey, error: (e as Error).message })
  }
}

// ─── USDC trustline ────────────────────────────────────────────────────────────
/**
 * Creates a USDC trustline on the given account.
 * Must be called after the account exists on-chain with sufficient XLM balance.
 */
export async function createUsdcTrustline(secretKey: string): Promise<void> {
  const keypair = Keypair.fromSecret(secretKey)
  try {
    const account = await server.loadAccount(keypair.publicKey())
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(Operation.changeTrust({ asset: USDC_ASSET }))
      .setTimeout(30)
      .build()
    tx.sign(keypair)
    await server.submitTransaction(tx)
    logger.info('USDC trustline created', { publicKey: keypair.publicKey() })
  } catch (e) {
    throw new StellarError('USDC trustline creation failed', {
      publicKey: keypair.publicKey(),
      error: (e as Error).message,
    })
  }
}

// ─── Balance ───────────────────────────────────────────────────────────────────
/**
 * Returns the USDC balance for an account as a string ("0.0000000" if none).
 */
export async function getUsdcBalance(publicKey: string): Promise<string> {
  try {
    const account = await server.loadAccount(publicKey)
    const usdcBalance = account.balances.find(
      (b) =>
        b.asset_type === 'credit_alphanum4' &&
        (b as Horizon.HorizonApi.BalanceLineAsset).asset_code === 'USDC' &&
        (b as Horizon.HorizonApi.BalanceLineAsset).asset_issuer === USDC_ISSUER,
    )
    return usdcBalance?.balance ?? '0.0000000'
  } catch (e) {
    throw new StellarError('Failed to fetch balance', {
      publicKey,
      error: (e as Error).message,
    })
  }
}

// ─── Address validation helpers ────────────────────────────────────────────────
export function isStellarAddress(address: string): boolean {
  return address.startsWith('G') && address.length === 56
}

export function isEvmAddress(address: string): boolean {
  return address.startsWith('0x') && address.length === 42
}

export function detectChain(recipient: string): 'stellar' | 'base' {
  if (isStellarAddress(recipient)) return 'stellar'
  if (isEvmAddress(recipient)) return 'base'
  throw new StellarError(`Cannot detect destination chain from recipient: ${recipient}`)
}

// ─── Memo validation ───────────────────────────────────────────────────────────
export function validateMemo(memo: string): void {
  // Stellar transaction memo max: 28 bytes
  if (Buffer.byteLength(memo, 'utf8') > 28) {
    throw new Error(`Memo exceeds 28-byte Stellar limit (got ${Buffer.byteLength(memo, 'utf8')} bytes)`)
  }
}

export { NETWORK, NETWORK_PASSPHRASE, HORIZON_URL }
