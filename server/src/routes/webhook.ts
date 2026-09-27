import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ingestWebhookLead } from '../controllers/lead.controller';
import { verifyWebhookSignature } from '../middleware/verifyWebhookSignature';

export const webhookRouter = Router();

/**
 * Per-tenant rate limiter — keyed by brokerageSlug from the URL.
 * Allows one brokerage's burst to never affect another's quota.
 *
 * Limit: 120 requests/min per brokerage slug (generous for normal use,
 * protective against accidental floods without blocking legitimate bursts).
 */
const webhookRateLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 120,
  // Key by IP + slug so one IP can't flood multiple brokerages
  keyGenerator: (req) => `${req.ip}:${req.params.brokerageSlug ?? 'unknown'}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded — slow down ingestion' },
});

/**
 * POST /api/webhooks/leads/:brokerageSlug
 *
 * External lead intake endpoint.
 * - No JWT auth (called by external tools like Typeform, Facebook Lead Ads)
 * - Protected by brokerage slug + HMAC-SHA256 signature when WEBHOOK_SECRET is set
 * - Idempotent: duplicate requests with same externalId+source are safe
 *
 * Body: ExternalLeadWebhookPayload
 */
webhookRouter.post(
  '/leads/:brokerageSlug',
  webhookRateLimiter,
  verifyWebhookSignature,
  ingestWebhookLead,
);
