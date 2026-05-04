/**
 * routes/wallet.ts
 *
 * GET /wallet/balance — live USDC balance with 30s cache
 */

import { type Router } from 'express'
import { Router as ExpressRouter } from 'express'
import { requireApiKey } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { getUsdcBalance } from '../services/stellar.js'
import { logger } from '../lib/logger.js'

export const walletRouter: Router = ExpressRouter()

const CACHE_TTL_MS = 30_000 // 30 seconds

// ─── GET /wallet/balance ──────────────────────────────────────────────────────

walletRouter.get('/wallet/balance', requireApiKey, async (req, res, next) => {
  const userId = req.userId!

  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId } })

    if (!wallet) {
      sendError(res, 'Wallet not found.', 'WALLET_NOT_FOUND', 404)
      return
    }

    if (wallet.status !== 'READY') {
      sendError(
        res,
        'Wallet is not ready. Bootstrap may still be in progress.',
        'WALLET_NOT_READY',
        503,
      )
      return
    }

    const now = new Date()
    const cacheAge = wallet.balanceCachedAt
      ? now.getTime() - wallet.balanceCachedAt.getTime()
      : Infinity

    let balance: string
    let cachedAt: string

    if (cacheAge < CACHE_TTL_MS) {
      // Serve from cache
      balance = wallet.balanceCache.toFixed(7)
      cachedAt = wallet.balanceCachedAt!.toISOString()
    } else {
      // Fetch live from Horizon and refresh cache
      try {
        const live = await getUsdcBalance(wallet.stellarPublicKey)
        if (live !== null) {
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balanceCache: live, balanceCachedAt: now },
          })
          balance = live
          cachedAt = now.toISOString()
        } else {
          // USDC trustline not found — return 0
          balance = '0.0000000'
          cachedAt = now.toISOString()
        }
      } catch (horizonErr) {
        // Horizon unavailable — fall back to stale cache rather than erroring
        logger.warn('Horizon balance fetch failed — serving stale cache', {
          userId,
          error: (horizonErr as Error).message,
        })
        balance = wallet.balanceCache.toFixed(7)
        cachedAt = wallet.balanceCachedAt?.toISOString() ?? now.toISOString()
      }
    }

    sendSuccess(res, {
      balance,
      currency: 'USDC',
      wallet_address: wallet.stellarPublicKey,
      cached_at: cachedAt,
    })
  } catch (err) {
    next(err)
  }
})
