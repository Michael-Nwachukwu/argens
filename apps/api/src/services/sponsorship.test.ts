import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  Account,
  Asset,
  FeeBumpTransaction,
  Keypair,
  Operation,
  SorobanDataBuilder,
  Transaction,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  type Horizon,
} from '@stellar/stellar-sdk'

// The module reads STELLAR_NETWORK at import time, so each test loads a fresh copy
// for the network it is asserting about.
async function loadSponsorship(network: 'testnet' | 'mainnet', opsSecret?: string) {
  vi.stubEnv('STELLAR_NETWORK', network)
  vi.stubEnv('ARGENS_OPS_WALLET_SECRET', opsSecret ?? '')
  vi.resetModules()
  return import('./sponsorship.js')
}

const TESTNET_USDC_SAC = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'

let ops: Keypair
let user: Keypair

beforeEach(() => {
  ops = Keypair.random()
  user = Keypair.random()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function signedUserPayment(): Transaction {
  const tx = new TransactionBuilder(new Account(user.publicKey(), '41'), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
        amount: '10.0000000',
      }),
    )
    .setTimeout(30)
    .build()
  tx.sign(user)
  return tx
}

function signedUserSorobanCall(inclusionFee: string, resourceFee: number): Transaction {
  const tx = new TransactionBuilder(new Account(user.publicKey(), '41'), {
    fee: inclusionFee,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.invokeContractFunction({ contract: TESTNET_USDC_SAC, function: 'approve', args: [] }))
    .setSorobanData(new SorobanDataBuilder().setResourceFee(resourceFee).build())
    .setTimeout(60)
    .build()
  tx.sign(user)
  return tx
}

describe('innerInclusionFeeRate', () => {
  it('is the per-op fee for a classic transaction', async () => {
    const { innerInclusionFeeRate } = await loadSponsorship('testnet')
    expect(innerInclusionFeeRate(signedUserPayment())).toBe('100')
  })

  it('excludes the Soroban resource fee', async () => {
    const { innerInclusionFeeRate } = await loadSponsorship('testnet')
    // Builder fee = inclusion 100000 + resource 25000; the rate must ignore the resource part.
    expect(innerInclusionFeeRate(signedUserSorobanCall('100000', 25_000))).toBe('100000')
  })
})

describe('withFeeSponsor', () => {
  it('wraps a classic tx in a fee-bump paid and signed by the ops wallet', async () => {
    const { withFeeSponsor } = await loadSponsorship('testnet', ops.secret())
    const inner = signedUserPayment()

    const wrapped = withFeeSponsor(inner)

    expect(wrapped).toBeInstanceOf(FeeBumpTransaction)
    const feeBump = wrapped as FeeBumpTransaction
    expect(feeBump.feeSource).toBe(ops.publicKey())
    // One payment op: rate 100 × (1 op + 1 for the fee-bump itself).
    expect(feeBump.fee).toBe('200')
    // The inner payment — user source, user sequence, user signature — is untouched.
    expect(feeBump.innerTransaction.hash().equals(inner.hash())).toBe(true)
    expect(feeBump.innerTransaction.source).toBe(user.publicKey())
    expect(feeBump.innerTransaction.sequence).toBe('42')
    expect(ops.verify(feeBump.hash(), feeBump.signatures[0]!.signature())).toBe(true)
  })

  it('carries the Soroban resource fee into the outer fee', async () => {
    const { withFeeSponsor } = await loadSponsorship('testnet', ops.secret())
    const feeBump = withFeeSponsor(signedUserSorobanCall('100000', 25_000)) as FeeBumpTransaction

    // inclusion rate 100000 × (1 op + 1) + resource 25000
    expect(feeBump.fee).toBe('225000')
  })

  it('passes the tx through unsponsored on testnet with no ops key', async () => {
    const { withFeeSponsor } = await loadSponsorship('testnet')
    const inner = signedUserPayment()
    expect(withFeeSponsor(inner)).toBe(inner)
  })

  it('refuses to submit unsponsored on mainnet', async () => {
    const { withFeeSponsor } = await loadSponsorship('mainnet')
    expect(() => withFeeSponsor(signedUserPayment())).toThrow(/ARGENS_OPS_WALLET_SECRET/)
  })
})

describe('buildSponsoredActivationTx', () => {
  it('creates a 0-XLM account and its USDC trustline inside one sponsorship sandwich', async () => {
    const { buildSponsoredActivationTx } = await loadSponsorship('testnet', ops.secret())
    const tx = buildSponsoredActivationTx(new Account(ops.publicKey(), '7'), ops, user)

    expect(tx.source).toBe(ops.publicKey())
    expect(tx.operations.map((op) => op.type)).toEqual([
      'beginSponsoringFutureReserves',
      'createAccount',
      'changeTrust',
      'endSponsoringFutureReserves',
    ])

    const [begin, create, trust, end] = tx.operations as unknown as Array<Record<string, unknown>>
    expect(begin!['sponsoredId']).toBe(user.publicKey())
    expect(begin!['source']).toBeUndefined() // the ops wallet, as tx source
    expect(create!['destination']).toBe(user.publicKey())
    expect(create!['startingBalance']).toBe('0.0000000') // no XLM leaves the ops wallet
    expect(trust!['source']).toBe(user.publicKey())
    expect((trust!['line'] as Asset).getCode()).toBe('USDC')
    expect(end!['source']).toBe(user.publicKey())
  })

  it('is signed by both the ops wallet and the user', async () => {
    const { buildSponsoredActivationTx } = await loadSponsorship('testnet', ops.secret())
    const tx = buildSponsoredActivationTx(new Account(ops.publicKey(), '7'), ops, user)

    expect(tx.signatures).toHaveLength(2)
    const verifiedBy = (kp: Keypair) => tx.signatures.some((s) => kp.verify(tx.hash(), s.signature()))
    expect(verifiedBy(ops)).toBe(true)
    expect(verifiedBy(user)).toBe(true)
  })
})

describe('buildSponsoredTrustlineTx', () => {
  it('opens only the trustline, reserve sponsored, for an existing account', async () => {
    const { buildSponsoredTrustlineTx } = await loadSponsorship('testnet', ops.secret())
    const tx = buildSponsoredTrustlineTx(new Account(ops.publicKey(), '7'), ops, user)

    expect(tx.operations.map((op) => op.type)).toEqual([
      'beginSponsoringFutureReserves',
      'changeTrust',
      'endSponsoringFutureReserves',
    ])
    expect(tx.signatures).toHaveLength(2)
  })
})

describe('spendableXlm', () => {
  type AccountFields = Parameters<Awaited<ReturnType<typeof loadSponsorship>>['spendableXlm']>[0]
  const account = (
    balance: string,
    subentry_count: number,
    num_sponsoring = 0,
    num_sponsored = 0,
    selling_liabilities = '0.0000000',
  ): AccountFields =>
    ({
      balances: [{ asset_type: 'native', balance, selling_liabilities } as Horizon.HorizonApi.BalanceLineNative],
      subentry_count,
      num_sponsoring,
      num_sponsored,
    }) as AccountFields

  it('subtracts the reserves the ops wallet has sponsored', async () => {
    const { spendableXlm } = await loadSponsorship('testnet')
    // 10 sponsored wallets × 3 reserve units: min balance (2 + 0 + 30) × 0.5 = 16
    expect(spendableXlm(account('100.0000000', 0, 30))).toBe('84.0000000')
  })

  it('reports a sponsored user wallet as holding nothing spendable — and nothing owed', async () => {
    const { spendableXlm } = await loadSponsorship('testnet')
    // 0 XLM, one trustline, all 3 reserve units sponsored: min balance (2 + 1 - 3) × 0.5 = 0
    expect(spendableXlm(account('0.0000000', 1, 0, 3))).toBe('0.0000000')
  })

  it('reports a legacy 2.0 XLM wallet as holding its 0.5 XLM fee buffer', async () => {
    const { spendableXlm } = await loadSponsorship('testnet')
    expect(spendableXlm(account('2.0000000', 1))).toBe('0.5000000')
  })

  it('subtracts selling liabilities and never goes negative', async () => {
    const { spendableXlm } = await loadSponsorship('testnet')
    expect(spendableXlm(account('20.0000000', 0, 0, 0, '3.0000000'))).toBe('16.0000000')
    expect(spendableXlm(account('1.0000000', 0, 30))).toBe('0.0000000')
  })
})
