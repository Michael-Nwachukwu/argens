/**
 * scripts/setup-fee-wallet.mjs
 *
 * Creates the fee wallet on Stellar mainnet and establishes a USDC trustline.
 * Run ONCE after the ops wallet has been funded with mainnet XLM.
 *
 * Usage: node scripts/setup-fee-wallet.mjs
 *
 * Requires apps/api/.env to have:
 *   ARGENS_OPS_WALLET_SECRET   — funded with >= 2 XLM
 *   ARGENS_FEE_WALLET          — public key of the fee wallet
 *   ARGENS_FEE_WALLET_SECRET   — secret key of the fee wallet
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env manually
const envPath = resolve(__dirname, '../apps/api/.env')
const envLines = readFileSync(envPath, 'utf-8').split('\n')
for (const line of envLines) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) {
    const val = rest.join('=').replace(/^"(.*)"$/, '$1')
    process.env[key.trim()] = val
  }
}

const { Horizon, Networks, Keypair, TransactionBuilder, Operation, Asset, BASE_FEE } = await import('../apps/api/node_modules/@stellar/stellar-sdk/lib/index.js')

const HORIZON_URL = 'https://horizon.stellar.org'
const NETWORK_PASSPHRASE = Networks.PUBLIC
const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
const USDC = new Asset('USDC', USDC_ISSUER)

const OPS_SECRET = process.env.ARGENS_OPS_WALLET_SECRET
const FEE_PUBLIC = process.env.ARGENS_FEE_WALLET
const FEE_SECRET = process.env.ARGENS_FEE_WALLET_SECRET

if (!OPS_SECRET || !FEE_PUBLIC || !FEE_SECRET) {
  console.error('Missing ARGENS_OPS_WALLET_SECRET, ARGENS_FEE_WALLET, or ARGENS_FEE_WALLET_SECRET in .env')
  process.exit(1)
}

const server = new Horizon.Server(HORIZON_URL)
const opsKeypair = Keypair.fromSecret(OPS_SECRET)
const feeKeypair = Keypair.fromSecret(FEE_SECRET)

if (feeKeypair.publicKey() !== FEE_PUBLIC) {
  console.error('ARGENS_FEE_WALLET_SECRET does not match ARGENS_FEE_WALLET public key')
  process.exit(1)
}

console.log('Ops wallet:  ', opsKeypair.publicKey())
console.log('Fee wallet:  ', FEE_PUBLIC)
console.log()

const TARGET_FEE_WALLET_XLM = 2.0 // 1.5 reserve (after trustline) + 0.5 XLM tx fee buffer

// Step 1: Check if fee wallet already exists
let feeExists = false
let currentXlm = 0
try {
  const feeAccount = await server.loadAccount(FEE_PUBLIC)
  feeExists = true
  const native = feeAccount.balances.find(b => b.asset_type === 'native')
  currentXlm = native ? parseFloat(native.balance) : 0
  const usdcBalance = feeAccount.balances.find(b => b.asset_type !== 'native' && b.asset_code === 'USDC')
  if (usdcBalance) {
    console.log('Fee wallet already exists on mainnet with USDC trustline. Nothing to do.')
    process.exit(0)
  }
  console.log(`Fee wallet exists with ${currentXlm} XLM but has no USDC trustline.`)
} catch {
  console.log('Fee wallet does not exist on mainnet. Creating it now...')
}

// Step 2: Create or top up fee wallet so it has enough XLM for trustline + tx fee
if (!feeExists) {
  console.log(`Step 1: Sending ${TARGET_FEE_WALLET_XLM} XLM from ops wallet to create fee wallet...`)
  const opsAccount = await server.loadAccount(opsKeypair.publicKey())
  const createTx = new TransactionBuilder(opsAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.createAccount({
      destination: FEE_PUBLIC,
      startingBalance: TARGET_FEE_WALLET_XLM.toFixed(7),
    }))
    .setTimeout(30)
    .build()
  createTx.sign(opsKeypair)
  const createResult = await server.submitTransaction(createTx)
  console.log('  Account created. Tx hash:', createResult.hash)
} else if (currentXlm < TARGET_FEE_WALLET_XLM) {
  const topUp = (TARGET_FEE_WALLET_XLM - currentXlm).toFixed(7)
  console.log(`Step 1: Topping up fee wallet with ${topUp} XLM (current: ${currentXlm}, target: ${TARGET_FEE_WALLET_XLM})...`)
  const opsAccount = await server.loadAccount(opsKeypair.publicKey())
  const topUpTx = new TransactionBuilder(opsAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.payment({
      destination: FEE_PUBLIC,
      asset: Asset.native(),
      amount: topUp,
    }))
    .setTimeout(30)
    .build()
  topUpTx.sign(opsKeypair)
  const topUpResult = await server.submitTransaction(topUpTx)
  console.log('  Top-up sent. Tx hash:', topUpResult.hash)
}

// Step 3: Create USDC trustline from fee wallet
console.log('Step 2: Creating USDC trustline from fee wallet...')
const feeAccount = await server.loadAccount(FEE_PUBLIC)
const trustTx = new TransactionBuilder(feeAccount, {
  fee: BASE_FEE,
  networkPassphrase: NETWORK_PASSPHRASE,
})
  .addOperation(Operation.changeTrust({ asset: USDC }))
  .setTimeout(30)
  .build()
trustTx.sign(feeKeypair)
const trustResult = await server.submitTransaction(trustTx)
console.log('  USDC trustline created. Tx hash:', trustResult.hash)

console.log()
console.log('Fee wallet setup complete.')
console.log('Verify at: https://stellar.expert/explorer/public/account/' + FEE_PUBLIC)
