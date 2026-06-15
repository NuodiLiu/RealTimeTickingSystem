import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Middleware to verify Azure SignalR Service webhook signatures
 * This ensures that webhook requests are actually from Azure SignalR Service
 * 
 * Azure SignalR adds these headers:
 * - x-asrs-signature: HMAC-SHA256 signature of the request body
 * - x-asrs-connection-id: Unique connection identifier
 * - x-asrs-user-id: User ID from the access token
 */

export function verifySignalRWebhookSignature(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.AZURE_SIGNALR_WEBHOOK_SECRET;
  
  // Skip signature verification if not configured
  if (!secret) {
    console.warn('[Webhook] AZURE_SIGNALR_WEBHOOK_SECRET not configured - signature verification disabled');
    return next();
  }

  const signature = req.headers['x-asrs-signature'] as string;
  
  if (!signature) {
    console.warn('[Webhook] Missing x-asrs-signature header');
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  try {
    // Get raw body (should be set by Express json parser with verify option)
    const rawBody = (req as any).rawBody;
    
    if (!rawBody) {
      console.error('[Webhook] Raw body not available for signature verification');
      res.status(500).json({ error: 'Cannot verify signature without raw body' });
      return;
    }

    // Calculate expected signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    // Compare signatures (timing-safe comparison)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.warn('[Webhook] Invalid signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Signature is valid, proceed
    next();
  } catch (error) {
    console.error('[Webhook] Error verifying signature:', error);
    res.status(500).json({ error: 'Signature verification failed' });
  }
}

/**
 * Middleware to log webhook requests for debugging
 */
export function logWebhookRequest(req: Request, res: Response, next: NextFunction): void {
  const connectionId = req.headers['x-asrs-connection-id'];
  const userId = req.headers['x-asrs-user-id'];
  const event = req.path.split('/').pop();
  
  console.log(`[Webhook] ${event?.toUpperCase()} - userId: ${userId}, connectionId: ${connectionId}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[Webhook] Headers:', {
      signature: req.headers['x-asrs-signature'] ? 'present' : 'missing',
      connectionId,
      userId,
      contentType: req.headers['content-type']
    });
    console.log('[Webhook] Body:', req.body);
  }
  
  next();
}
