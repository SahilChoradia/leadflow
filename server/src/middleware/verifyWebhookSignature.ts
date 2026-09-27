import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Verifies optional or required HMAC SHA256 webhook signatures.
 * Header: X-Webhook-Signature or X-LeadFlow-Signature: sha256=<hex> or <hex>
 *
 * If WEBHOOK_SECRET is set in environment, signature verification is strictly enforced.
 * If signature header is provided even without WEBHOOK_SECRET set, it is checked if secret is configured.
 */
export function verifyWebhookSignature(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.WEBHOOK_SECRET;

  const rawHeader =
    (req.headers['x-leadflow-signature'] as string) ||
    (req.headers['x-webhook-signature'] as string) ||
    (req.headers['x-hub-signature-256'] as string);

  // If secret is set, signature is strictly required
  if (secret) {
    if (!rawHeader) {
      res.status(401).json({
        success: false,
        error: 'Missing webhook signature header (X-LeadFlow-Signature)',
      });
      return;
    }

    const signature = rawHeader.startsWith('sha256=')
      ? rawHeader.slice(7)
      : rawHeader;

    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      res.status(401).json({
        success: false,
        error: 'Invalid webhook signature',
      });
      return;
    }
  }

  next();
}
