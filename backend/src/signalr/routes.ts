import { Router, Request, Response } from 'express';
import { verifyAzureJWT, requireScopes } from '../middlewares/azure-auth.middleware';
import { requireDevice } from '../middlewares/auth.middleware';
import { signalRConfig } from './config';

const router = Router();

// Device connection endpoint - requires device API key
router.get('/device/connect', 
  requireDevice, 
  async (req: Request, res: Response) => {
    try {
      if (!req.device) {
        return res.status(401).json({ error: 'Device authentication required' });
      }

      const deviceId = req.device.deviceId;
      const connectionInfo = signalRConfig.getConnectionInfo(deviceId);

      res.json({
        url: connectionInfo.url,
        accessToken: connectionInfo.accessToken,
        deviceId: deviceId,
        mode: req.device.device?.mode || 'kiosk'
      });
    } catch (error) {
      console.error('Error generating device connection URL:', error);
      res.status(500).json({ error: 'Failed to generate connection URL' });
    }
  }
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

export default router;
