import { prisma } from '../lib/prisma.js'
import { encryptSecretKey } from '../lib/crypto.js'
import { createStellarWallet } from './stellar.js'
import { activateAccount, inspectAccount } from './sponsorship.js'
import { logger } from '../lib/logger.js'
import { StellarError } from '../lib/errors.js'

/**
 * Full wallet bootstrap sequence for a new user.
 *
 * 1. Generate keypair
 * 2. Persist encrypted secret key (status = INITIALISING) and seed the Policy row
 * 3. Activate on-chain — one atomic transaction that creates the account with 0 XLM and opens
 *    its USDC trustline, both reserves sponsored by the ops wallet (see services/sponsorship.ts)
 * 4. Mark wallet READY
 *
 * If activation fails, the chain — not the error — decides the outcome, because a submit that
 * timed out can still land:
 *   - account + trustline    → READY
 *   - account, no trustline  → TRUSTLINE_PENDING
 *   - account missing / chain unreadable → row stays INITIALISING and we throw (caller → 503)
 *
 * The row is never deleted. The caller (/auth/verify) has already marked the email verified,
 * so a deleted row would leave a user who can neither re-verify nor retry. Kept, the row is
 * recovered by POST /wallet/bootstrap-retry, which re-activates with the same key.
 */
export async function bootstrapWallet(userId: string): Promise<{ publicKey: string }> {
  const { publicKey, secretKey } = createStellarWallet()
  const stellarSecretKeyEnc = encryptSecretKey(secretKey)

  // Persist the wallet row immediately so we can update status as bootstrap progresses.
  const wallet = await prisma.wallet.create({
    data: {
      userId,
      stellarPublicKey: publicKey,
      stellarSecretKeyEnc,
      status: 'INITIALISING',
    },
  })

  // Seed an empty Policy record for this user — independent of on-chain activation.
  await prisma.policy.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })

  try {
    await activateAccount(secretKey)
    await prisma.wallet.update({ where: { id: wallet.id }, data: { status: 'READY' } })
    logger.info('Wallet bootstrapped and ready', { userId, publicKey })
    return { publicKey }
  } catch (activationErr) {
    const error = (activationErr as Error).message
    const state = await inspectAccount(publicKey).catch(() => null)

    if (state === 'ready') {
      await prisma.wallet.update({ where: { id: wallet.id }, data: { status: 'READY' } })
      logger.warn('Wallet activation reported failure but the account is ready on-chain', { userId, publicKey, error })
      return { publicKey }
    }

    if (state === 'no_trustline') {
      // Account exists but the trustline did not open — recoverable from the dashboard.
      await prisma.wallet.update({ where: { id: wallet.id }, data: { status: 'TRUSTLINE_PENDING' } })
      logger.error('Wallet account exists but USDC trustline is missing — marked TRUSTLINE_PENDING', {
        userId,
        publicKey,
        error,
      })
      return { publicKey }
    }

    logger.error('Wallet activation failed — row left INITIALISING for retry', {
      userId,
      publicKey,
      onChainState: state ?? 'unknown',
      error,
    })
    throw new StellarError(
      'Your email is verified, but wallet setup on Stellar did not finish. Open the dashboard and retry wallet setup.',
      { userId },
    )
  }
}
