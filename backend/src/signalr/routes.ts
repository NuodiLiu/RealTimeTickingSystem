import { Router, Request, Response } from 'express';
import { verifyAzureJWT, requireScopes } from '../middlewares/azure-auth.middleware';
import { requireJWTAuthUnified } from '../middlewares/jwt-auth.middleware';
import { signalRConfig } from './config';
import { getDeviceConnectionUrl, signalRAuthMiddleware } from './auth';
import { SignalRWebhookController } from './webhook.controller';

const router = Router();

// Unified SignalR negotiate endpoint
// Supports App JWT authentication for both devices (iPad) and staff (Portal)
router.post('/negotiate', 
  requireJWTAuthUnified,
  async (req: Request, res: Response) => {
    try {
      let userId: string;
      let additionalInfo: any = {};

      if (req.device) {
        // Device (iPad app) with App JWT
        userId = req.device.deviceId;
        additionalInfo = {
          deviceId: req.device.deviceId,
          mode: req.device.device?.mode || 'REGISTRATION',
          user: {
            id: req.device.deviceId,
            type: req.device.device?.mode || 'REGISTRATION'
          }
        };
        console.log('Generated SignalR negotiate response for device:', userId);
      } else if (req.user) {
        // Staff (Portal dashboard) with App JWT
        userId = req.user.id;
        additionalInfo = {
          userId: req.user.id,
          userInfo: {
            employeeNo: req.user.employeeNo,
            role: req.user.role
          }
        };
        console.log('Generated SignalR negotiate response for staff:', userId);
      } else {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Generate Azure SignalR connection info
      const connectionInfo = signalRConfig.getConnectionInfo(userId);

      res.json({
        url: connectionInfo.url,
        accessToken: connectionInfo.accessToken,
        ...additionalInfo
      });
    } catch (error) {
      console.error('Error in SignalR negotiate:', error);
      res.status(500).json({ error: 'Failed to negotiate SignalR connection' });
    }
  }
);

// Device connection endpoint - requires device API key (legacy)
router.get('/device/connect', 
  signalRAuthMiddleware as any, 
  getDeviceConnectionUrl as any
);

// Dashboard connection endpoint - requires Azure AD auth
router.get('/dashboard/connect', 
  verifyAzureJWT,
  requireScopes(['Api.Read']),
  async (req: Request, res: Response) => {
    try {
      if (!req.azureAuth) {
        return res.status(401).json({ error: 'Azure AD authentication required' });
      }

      // Use identityKey as stable user ID for SignalR
      const userId = req.azureAuth.identityKey;
      console.log('Generating SignalR connection for user:', userId);

      // Get Azure SignalR Service connection info
      const connectionInfo = signalRConfig.getConnectionInfo(userId);

      console.log('Generated SignalR connection URL successfully');

      res.json({
        url: connectionInfo.url,
        accessToken: connectionInfo.accessToken,
        userId: userId,
        userInfo: {
          name: req.azureAuth.name,
          email: req.azureAuth.email,
          tenantId: req.azureAuth.tid
        }
      });
    } catch (error) {
      console.error('Error generating dashboard connection URL:', error);
      res.status(500).json({ error: 'Failed to generate connection URL' });
    }
  }
);

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'SignalR',
    timestamp: new Date().toISOString()
  });
});

// ===== Azure SignalR Webhook Endpoints =====
// These endpoints receive events from Azure SignalR Service
// Configure these URLs in Azure SignalR Service upstream settings
// 
// Webhook middleware:
// 1. logWebhookRequest - logs all webhook events
// 2. verifySignalRWebhookSignature - verifies HMAC signature (production)

// Webhook: Client connected
router.post('/webhook/connected', SignalRWebhookController.handleConnected);

// Webhook: Client disconnected
router.post('/webhook/disconnected', SignalRWebhookController.handleDisconnected);

// Webhook: Upstream message from client
router.post('/webhook/message', SignalRWebhookController.handleMessage);

// Webhook: Abuse detection (optional)
router.post('/webhook/abuse', SignalRWebhookController.handleAbuse);

// Webhook health check
router.get('/webhook/health', SignalRWebhookController.healthCheck);

export default router;
