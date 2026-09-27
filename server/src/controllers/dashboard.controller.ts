import { Request, Response } from 'express';
import { getDashboardMetrics, invalidateAndRefreshMetrics } from '../services/dashboard.service';

/**
 * Get pre-aggregated dashboard metrics for the current brokerage.
 * Fast response backed by Redis cache and materialized summary document.
 * GET /api/dashboard/metrics
 */
export async function getMetrics(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const metrics = await getDashboardMetrics(brokerageId);
  res.json({
    success: true,
    data: metrics,
  });
}

/**
 * Force a recalculation and cache refresh.
 * POST /api/dashboard/refresh
 */
export async function refreshMetrics(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const metrics = await invalidateAndRefreshMetrics(brokerageId);
  res.json({
    success: true,
    data: metrics,
    message: 'Dashboard metrics refreshed and broadcast',
  });
}
