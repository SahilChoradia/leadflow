import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@leadflow/types';

/**
 * requireRole — factory that returns a middleware allowing only the specified roles.
 *
 * Usage:
 *   router.post('/brokerages', authenticate, requireRole('platform_admin'), handler)
 *   router.get('/leads',       authenticate, requireRole('advisor', 'brokerage_admin'), handler)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Forbidden: requires one of [${roles.join(', ')}]`,
      });
      return;
    }

    next();
  };
}

/**
 * requireBrokerageAccess — ensures the requesting user belongs to the brokerage
 * identified by req.params.brokerageId (or the path-param name you pass).
 *
 * Platform admins always pass. All others must match their own brokerageId.
 */
export function requireBrokerageAccess(paramName = 'brokerageId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthenticated' });
      return;
    }

    // Platform admin can access any brokerage
    if (req.user.role === 'platform_admin') return next();

    const requestedId = req.params[paramName];
    if (req.user.brokerageId !== requestedId) {
      // Return 404 (not 403) to avoid confirming the brokerage exists
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }

    next();
  };
}
