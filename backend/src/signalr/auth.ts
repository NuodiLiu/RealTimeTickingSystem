import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { signalRConfig } from './config';
import { AuthedDevice } from './types';
import { validateDeviceApiKey } from '../lib/utils/auth';

export interface SignalRAuthRequest extends Omit<Request, 'device'> {
  device?: AuthedDevice;
  userId?: string;
}

export async function generateSignalRToken(device: AuthedDevice): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required for SignalR authentication');
  }

  const token = jwt.sign(
    {
      deviceId: device.deviceId,
      mode: device.mode,
      type: 'device',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    },
    secret
  );

  return token;
}

export async function generateDashboardToken(userId: string): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required for SignalR authentication');
  }

  const token = jwt.sign(
    {
      userId,
      type: 'dashboard',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    },
    secret
  );

  return token;
}

export function verifySignalRToken(token: string): { deviceId?: string; userId?: string; mode?: string; type: string } | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is required for SignalR authentication');
    }

    const decoded = jwt.verify(token, secret) as any;
    return {
      deviceId: decoded.deviceId,
      userId: decoded.userId,
      mode: decoded.mode,
      type: decoded.type
    };
  } catch (error) {
    console.error('SignalR token verification failed:', error);
    return null;
  }
}

export async function signalRAuthMiddleware(req: SignalRAuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifySignalRToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (decoded.type === 'device' && decoded.deviceId && decoded.mode) {
      req.device = {
        deviceId: decoded.deviceId,
        mode: decoded.mode as any
      };
    } else if (decoded.type === 'dashboard' && decoded.userId) {
      req.userId = decoded.userId;
    } else {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    next();
  } catch (error) {
    console.error('SignalR auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

// SignalR connection URL generation endpoints
export async function getDeviceConnectionUrl(req: SignalRAuthRequest, res: Response) {
  try {
    if (!req.device) {
      return res.status(401).json({ error: 'Device authentication required' });
    }

    const connectionUrl = await signalRConfig.getDeviceConnectionUrl(req.device.deviceId);
    const token = await generateSignalRToken(req.device);

    res.json({
      url: connectionUrl,
      token,
      deviceId: req.device.deviceId,
      mode: req.device.mode
    });
  } catch (error) {
    console.error('Error generating device connection URL:', error);
    res.status(500).json({ error: 'Failed to generate connection URL' });
  }
}

export async function getDashboardConnectionUrl(req: SignalRAuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const connectionUrl = await signalRConfig.getDashboardConnectionUrl(req.userId);
    const token = await generateDashboardToken(req.userId);

    res.json({
      url: connectionUrl,
      token,
      userId: req.userId
    });
  } catch (error) {
    console.error('Error generating dashboard connection URL:', error);
    res.status(500).json({ error: 'Failed to generate connection URL' });
  }
}

// New endpoint to convert device API key to SignalR JWT token
export async function generateSignalRTokenFromApiKey(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    // Validate the device API key using the existing auth utility
    const { deviceId, device } = await validateDeviceApiKey(authHeader);

    // Generate SignalR token for the device
    const signalRToken = await generateSignalRToken({
      deviceId: device.id,
      mode: device.mode as any
    });

    // Get SignalR connection URL
    const connectionUrl = await signalRConfig.getDeviceConnectionUrl(device.id);

    res.json({
      url: connectionUrl,
      token: signalRToken,
      deviceId: device.id,
      mode: device.mode
    });

  } catch (error) {
    console.error('Error generating SignalR token from API key:', error);
    
    // Handle specific auth errors
    if (error instanceof Error && error.message.includes('Invalid device')) {
      return res.status(401).json({ error: 'Invalid device credentials' });
    }
    
    res.status(500).json({ error: 'Failed to generate SignalR token' });
  }
}
