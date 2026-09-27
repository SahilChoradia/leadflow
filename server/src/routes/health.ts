import { Router } from 'express';

export const healthRouter = Router();

/**
 * GET /health
 * Simple liveness probe. Used by Render/Railway health checks and Docker.
 */
healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'leadflow-api',
    timestamp: new Date().toISOString(),
  });
});
