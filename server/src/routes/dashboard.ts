import { Router } from 'express';
import { getMetrics, refreshMetrics } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

// Advisors & Admins access dashboard metrics
dashboardRouter.get('/metrics', requireRole('brokerage_admin', 'advisor'), getMetrics);
dashboardRouter.post('/refresh', requireRole('brokerage_admin', 'advisor'), refreshMetrics);
