import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload, AuthUser } from '@leadflow/types';

// Extend Express Request to carry the decoded user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * authenticate — validates the Bearer JWT and attaches req.user.
 * All subsequent middleware/controllers can trust req.user is present.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;

    req.user = {
      id:          payload.sub,
      email:       '',       // not stored in JWT — fetch from DB if needed
      name:        '',       // same
      role:        payload.role,
      brokerageId: payload.brokerageId,
    };
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}
