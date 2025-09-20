import { Router, Request, Response } from 'express';
import { 
  signalRAuthMiddleware, 
  getDeviceConnectionUrl, 
  getDashboardConnectionUrl,
  SignalRAuthRequest,
  generateSignalRTokenFromApiKey
} from './auth';

const router = Router();

// Device connection endpoint (requires SignalR JWT token)
router.get('/device/connect', 
  signalRAuthMiddleware as any, 
  getDeviceConnectionUrl as any
);

// Device token generation endpoint (accepts device API key, returns SignalR JWT)
router.post('/device/token', generateSignalRTokenFromApiKey as any);

// Dashboard connection endpoint  
router.get('/dashboard/connect', 
  signalRAuthMiddleware as any, 
  getDashboardConnectionUrl as any
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
