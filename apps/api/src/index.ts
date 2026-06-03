import 'dotenv/config'
import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { authRouter } from './routes/auth.js'
import { transactionsRouter } from './routes/transactions.js'
import { walletRouter } from './routes/wallet.js'
import { agentRouter } from './routes/agent.js'
import { policiesRouter } from './routes/policies.js'
import { approveRouter } from './routes/approve.js'
import { x402Router } from './routes/x402.js'
import { marketplaceRouter } from './routes/marketplace.js'
import { adminRouter } from './routes/admin.js'
import { apiLimiter } from './middleware/ratelimit.js'
import { sendError } from './lib/response.js'
import { AppError } from './lib/errors.js'
import { logger } from './lib/logger.js'
import { prisma } from './lib/prisma.js'
import { startWatcher } from './services/watcher.js'

const app = express()
const PORT = Number(process.env['API_PORT'] ?? 3001)
const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'

// ─── Security ──────────────────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}))

// ─── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '64kb' }))

// ─── Global rate limit ─────────────────────────────────────────────────────────
app.use('/v1', apiLimiter)

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use('/v1/auth', authRouter)
app.use('/v1', transactionsRouter)
app.use('/v1', walletRouter)
app.use('/v1', agentRouter)
app.use('/v1', policiesRouter)
app.use('/v1', approveRouter)
app.use('/v1', x402Router)
app.use('/v1', marketplaceRouter)
app.use('/v1/admin', adminRouter)

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

// ─── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  sendError(res, 'Route not found', 'NOT_FOUND', 404)
})

// ─── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    sendError(res, err.message, err.code, err.statusCode, err.details)
    return
  }
  logger.error('Unhandled error', { error: err.message, stack: err.stack })
  sendError(res, 'An unexpected error occurred.', 'INTERNAL_ERROR', 500)
})

// ─── Start ─────────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    await prisma.$connect()
    logger.info('Database connected')
    startWatcher()
    app.listen(PORT, () => {
      logger.info(`Argens API running`, { port: PORT, network: process.env['STELLAR_NETWORK'] ?? 'testnet' })
    })
  } catch (e) {
    logger.error('Failed to start server', { error: (e as Error).message })
    process.exit(1)
  }
}

void start()
