import {
  Horizon,
  Networks,
  Keypair,
  Asset,
} from '@stellar/stellar-sdk'
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

// ─── Account activation ────────────────────────────────────────────────────────
// Funding and trustline creation live in services/sponsorship.ts (activateAccount):
// the ops wallet sponsors the reserves instead of transferring XLM to the user.

// ─── Balance ───────────────────────────────────────────────────────────────────
/**
 * Returns the USDC balance for an account as a string ("0.0000000" if none).
 */
/**
 * Returns USDC balance string, null if the account doesn't exist on this network,
 * or throws StellarError for actual Horizon connectivity failures.
 */
export async function getUsdcBalance(publicKey: string): Promise<string | null> {
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
    const status = (e as { response?: { status?: number } }).response?.status
    if (status === 404) {
      // Account doesn't exist on this network — not a connectivity error
      return null
    }
    throw new StellarError('Failed to fetch balance', {
      publicKey,
      error: (e as Error).message,
    })
  }
}

/**
 * Returns the native XLM balance as a string, or null if the account doesn't exist.
 */
export async function getXlmBalance(publicKey: string): Promise<string | null> {
  try {
    const account = await server.loadAccount(publicKey)
    const native = account.balances.find((b) => b.asset_type === 'native')
    return native?.balance ?? '0.0000000'
  } catch {
    return null
  }
}

/**
 * Fetch USDC and XLM balances with a single Horizon loadAccount call.
 * Returns null when the account doesn't exist on this network (404).
 * Throws StellarError for genuine connectivity failures.
 */
export async function getAccountBalances(
  publicKey: string,
): Promise<{ usdc: string; xlm: string } | null> {
  try {
    const account = await server.loadAccount(publicKey)
    const usdcBalance = account.balances.find(
      (b) =>
        b.asset_type === 'credit_alphanum4' &&
        (b as Horizon.HorizonApi.BalanceLineAsset).asset_code === 'USDC' &&
        (b as Horizon.HorizonApi.BalanceLineAsset).asset_issuer === USDC_ISSUER,
    )
    const native = account.balances.find((b) => b.asset_type === 'native')
    return {
      usdc: usdcBalance?.balance ?? '0.0000000',
      xlm: native?.balance ?? '0.0000000',
    }
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status
    if (status === 404) return null
    throw new StellarError('Failed to fetch balances', { publicKey, error: (e as Error).message })
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
