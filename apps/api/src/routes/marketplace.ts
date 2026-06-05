/**
 * routes/marketplace.ts
 *
 * GET  /marketplace/services — curated MPP service catalog
 * POST /marketplace/call    — call an MPP service using the user's Argens wallet
 */

import { type Router } from 'express'
import { Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { requireJwt, requireJwtOrApiKey } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { AppError } from '../lib/errors.js'
import {
  executeMarketplaceCall,
  getMarketplaceProviderSkillMarkdown,
  getMarketplaceServicesForResponse,
  MarketplaceBlockedError,
  MarketplacePendingApprovalError,
  setMarketplaceServiceEnabled,
} from '../services/marketplace.js'

export const marketplaceRouter: Router = ExpressRouter()

const MarketplaceCallSchema = z.object({
  service_id: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
})

const MarketplaceToggleSchema = z.object({
  enabled: z.boolean(),
})

const MarketplaceServicesQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  enabled: z.enum(['true', 'false']).optional(),
})

marketplaceRouter.get('/marketplace/services', requireJwtOrApiKey, async (req, res, next) => {
  try {
    const parsed = MarketplaceServicesQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, 'Invalid query parameters', 'VALIDATION_ERROR', 400, parsed.error.flatten())
      return
    }
    const { search, category, enabled } = parsed.data

    let providers = await getMarketplaceServicesForResponse(req.userId!)

    if (search) {
      const q = search.toLowerCase()
      providers = providers.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.categories.some((c) => c.toLowerCase().includes(q)) ||
          p.endpoints.some(
            (e) => e.label.toLowerCase().includes(q) || e.description.toLowerCase().includes(q),
          ),
      )
    }

    if (category) {
      const cat = category.toLowerCase()
      providers = providers.filter((p) => p.categories.some((c) => c.toLowerCase().includes(cat)))
    }

    if (enabled !== undefined) {
      const want = enabled === 'true'
      providers = providers.filter((p) => p.is_enabled === want)
    }

    sendSuccess(res, providers)
  } catch (err) {
    next(err)
  }
})

marketplaceRouter.get('/marketplace/services/:providerId/skill.md', async (req, res, next) => {
  try {
    const providerId = req.params.providerId
    if (!providerId || Array.isArray(providerId)) {
      sendError(res, 'Invalid provider id.', 'INVALID_REQUEST', 400)
      return
    }

    const markdown = await getMarketplaceProviderSkillMarkdown(providerId)
    if (!markdown) {
      sendError(res, 'Marketplace provider not found', 'SERVICE_NOT_FOUND', 404)
      return
    }

    res
      .status(200)
      .set({
        'Content-Type': 'text/markdown; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      })
      .send(markdown)
  } catch (err) {
    next(err)
  }
})

marketplaceRouter.get('/marketplace/services/:providerId', requireJwtOrApiKey, async (req, res, next) => {
  try {
    const providers = await getMarketplaceServicesForResponse(req.userId!)
    const provider = providers.find((p) => p.id === req.params.providerId)
    if (!provider) {
      sendError(res, 'Marketplace provider not found', 'SERVICE_NOT_FOUND', 404)
      return
    }
    sendSuccess(res, provider)
  } catch (err) {
    next(err)
  }
})

marketplaceRouter.patch(
  '/marketplace/services/:serviceId',
  requireJwt,
  validate(MarketplaceToggleSchema),
  async (req, res, next) => {
    const serviceId = req.params.serviceId
    if (!serviceId || Array.isArray(serviceId)) {
      sendError(res, 'Invalid service id.', 'INVALID_REQUEST', 400)
      return
    }
    try {
      const result = await setMarketplaceServiceEnabled(
        req.userId!,
        serviceId,
        (req.body as z.infer<typeof MarketplaceToggleSchema>).enabled,
      )
      sendSuccess(res, result)
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.code, err.statusCode, err.details)
        return
      }
      next(err)
    }
  },
)

marketplaceRouter.post(
  '/marketplace/services/:serviceId/enable',
  requireJwt,
  async (req, res, next) => {
    const serviceId = req.params.serviceId
    if (!serviceId || Array.isArray(serviceId)) {
      sendError(res, 'Invalid service id.', 'INVALID_REQUEST', 400)
      return
    }
    try {
      const result = await setMarketplaceServiceEnabled(req.userId!, serviceId, true)
      sendSuccess(res, result)
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.code, err.statusCode, err.details)
        return
      }
      next(err)
    }
  },
)

marketplaceRouter.post(
  '/marketplace/services/:serviceId/disable',
  requireJwt,
  async (req, res, next) => {
    const serviceId = req.params.serviceId
    if (!serviceId || Array.isArray(serviceId)) {
      sendError(res, 'Invalid service id.', 'INVALID_REQUEST', 400)
      return
    }
    try {
      const result = await setMarketplaceServiceEnabled(req.userId!, serviceId, false)
      sendSuccess(res, result)
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, err.code, err.statusCode, err.details)
        return
      }
      next(err)
    }
  },
)

marketplaceRouter.post(
  '/marketplace/call',
  requireJwtOrApiKey,
  validate(MarketplaceCallSchema),
  async (req, res, next) => {
    const userId = req.userId!
    const { service_id, payload, query } = req.body as z.infer<typeof MarketplaceCallSchema>

    try {
      const result = await executeMarketplaceCall(userId, {
        serviceId: service_id,
        payload,
        query,
      })
      sendSuccess(res, result)
    } catch (err) {
      if (err instanceof MarketplaceBlockedError) {
        sendError(res, err.message, err.code, err.statusCode, err.details)
        return
      }

      if (err instanceof MarketplacePendingApprovalError) {
        sendSuccess(
          res,
          {
            status: 'pending_approval',
            transaction_id: err.transactionId,
            message: 'Awaiting developer approval.',
            poll_url: `/v1/transactions/${err.transactionId}`,
          },
          202,
        )
        return
      }

      if (err instanceof AppError) {
        sendError(res, err.message, err.code, err.statusCode, err.details)
        return
      }

      next(err)
    }
  },
)
