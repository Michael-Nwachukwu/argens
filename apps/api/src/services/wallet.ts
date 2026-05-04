import { prisma } from '../lib/prisma.js'
import { encryptSecretKey } from '../lib/crypto.js'
import { createStellarWallet, fundNewAccount, createUsdcTrustline } from './stellar.js'
import { logger } from '../lib/logger.js'
import { StellarError } from '../lib/errors.js'

/**
 * Full wallet bootstrap sequence for a new user.
 *
 * 1. Generate keypair
 * 2. Persist encrypted secret key (status = INITIALISING)
 * 3. Fund account on-chain (friendbot on testnet, ops wallet on mainnet)
 * 4. Create USDC trustline
 * 5. Mark wallet READY
 *
 * If step 3 fails → delete the Wallet row, throw so the caller returns 503.
 * If step 4 fails → mark TRUSTLINE_PENDING; account is recoverable.
 */
export async function bootstrapWallet(userId: string): Promise<{ publicKey: string }> {
  const { publicKey, secretKey } = createStellarWallet()
  const stellarSecretKeyEnc = encryptSecretKey(secretKey)

  // Persist the wallet row immediately so we can update status as bootstrap progresses.
  let wallet = await prisma.wallet.create({
    data: {
      userId,
      stellarPublicKey: publicKey,
      stellarSecretKeyEnc,
      status: 'INITIALISING',
    },
  })

  // Step 3 — Fund account on-chain.
  try {
    await fundNewAccount(publicKey)
  } catch (e) {
    // Bootstrap failed before account exists on-chain — safe to delete the row.
    await prisma.wallet.delete({ where: { id: wallet.id } }).catch(() => undefined)
    logger.error('Wallet bootstrap failed at account funding — wallet row deleted', {
      userId,
      publicKey,
      error: (e as Error).message,
    })
    throw new StellarError(
      'Wallet creation failed: could not fund account on Stellar. Please try again.',
      { userId },
    )
  }

  // Step 4 — Create USDC trustline.
  try {
    await createUsdcTrustline(secretKey)
    wallet = await prisma.wallet.update({
      where: { id: wallet.id },
      data: { status: 'READY' },
    })
    logger.info('Wallet bootstrapped and ready', { userId, publicKey })
  } catch (e) {
    // Account exists on-chain but trustline failed — mark for manual retry.
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { status: 'TRUSTLINE_PENDING' },
    })
    logger.error('USDC trustline failed — wallet marked TRUSTLINE_PENDING', {
      userId,
      publicKey,
      error: (e as Error).message,
    })
    // Don't throw — the account is recoverable. Return the public key.
    // The dashboard will show a "retry trustline" action.
  }

  // Seed an empty Policy record for this user.
  await prisma.policy.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })

  return { publicKey }
}
