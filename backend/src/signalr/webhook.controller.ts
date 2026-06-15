import { Request, Response } from 'express';
import { signalREventHandler } from './eventHandler';
import { DeviceMode } from './types';

/**
 * Azure SignalR Service Webhook Controller
 * Handles connection lifecycle events from Azure SignalR Service
 * 
 * Event Types:
 * - connected: When a client connects to SignalR
 * - disconnected: When a client disconnects from SignalR
 * - message: When a client sends an upstream message
 */

export class SignalRWebhookController {
  
  /**
   * Handle connected event from Azure SignalR
   * Called when a device or dashboard connects
   */
  static async handleConnected(req: Request, res: Response): Promise<void> {
    try {
      const connectionId = req.headers['x-asrs-connection-id'] as string;
      const userId = req.headers['x-asrs-user-id'] as string || req.query.userId as string;
      
      console.log(`[Webhook] Connected event - userId: ${userId}, connectionId: ${connectionId}`);
      
      if (!userId || !connectionId) {
        console.warn('[Webhook] Missing userId or connectionId in connected event');
        res.status(400).json({ error: 'Missing userId or connectionId' });
        return;
      }
      
      // Determine user type from query params or request body
      const userType = (req.query.userType as string) || (req.body?.userType) || 'dashboard';
      
      if (userType === 'device') {
        // Extract mode from query params or body
        const mode = ((req.query.mode as string) || req.body?.mode || 'REGISTRATION') as DeviceMode;
        
        console.log(`[Webhook] Device connected: ${userId} with mode ${mode}`);
        await signalREventHandler.handleDeviceConnect(userId, connectionId, mode);
      } else {
        // Dashboard connection
        console.log(`[Webhook] Dashboard connected: ${userId}`);
        await signalREventHandler.handleDashboardConnect(connectionId, userId);
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('[Webhook] Error handling connected event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  /**
   * Handle disconnected event from Azure SignalR
   * Called when a device or dashboard disconnects
   */
  static async handleDisconnected(req: Request, res: Response): Promise<void> {
    try {
      const connectionId = req.headers['x-asrs-connection-id'] as string;
      const userId = req.headers['x-asrs-user-id'] as string || req.query.userId as string;
      
      console.log(`[Webhook] Disconnected event - userId: ${userId}, connectionId: ${connectionId}`);
      
      if (!userId || !connectionId) {
        console.warn('[Webhook] Missing userId or connectionId in disconnected event');
        res.status(400).json({ error: 'Missing userId or connectionId' });
        return;
      }
      
      // Determine user type
      const userType = (req.query.userType as string) || (req.body?.userType) || 'dashboard';
      
      if (userType === 'device') {
        console.log(`[Webhook] Device disconnected: ${userId}`);
        await signalREventHandler.handleDeviceDisconnect(userId, connectionId);
      } else {
        console.log(`[Webhook] Dashboard disconnected: ${userId}`);
        await signalREventHandler.handleDashboardDisconnect(connectionId);
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('[Webhook] Error handling disconnected event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  /**
   * Handle upstream message from Azure SignalR
   * Called when a device sends a message to the server
   */
  static async handleMessage(req: Request, res: Response): Promise<void> {
    try {
      const connectionId = req.headers['x-asrs-connection-id'] as string;
      const userId = req.headers['x-asrs-user-id'] as string || req.query.userId as string;
      
      console.log(`[Webhook] Message event - userId: ${userId}, connectionId: ${connectionId}`);
      
      if (!userId) {
        console.warn('[Webhook] Missing userId in message event');
        res.status(400).json({ error: 'Missing userId' });
        return;
      }
      
      const body = req.body || {};
      
      // Azure SignalR upstream invocation format
      // { Target: "methodName", Arguments: [...] }
      const target = body.Target || body.target;
      const args = body.Arguments || body.arguments || [];
      
      // Extract message from arguments (first argument is typically the message)
      const message = args[0] || body.message || body;
      
      console.log(`[Webhook] Upstream message from ${userId}:`, {
        target,
        messageType: message?.type,
        argsCount: args.length
      });
      
      // Handle device messages
      if (message?.type) {
        await signalREventHandler.handleDeviceMessage(userId, message);
      } else {
        console.warn('[Webhook] Message without type field:', message);
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('[Webhook] Error handling message event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  /**
   * Handle abuse detection event from Azure SignalR
   * Called when Azure detects potentially abusive behavior
   */
  static async handleAbuse(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.headers['x-asrs-user-id'] as string;
      const reason = req.body?.Reason || 'unknown';
      
      console.warn(`[Webhook] Abuse detected for userId: ${userId}, reason: ${reason}`);
      
      // Log the abuse event but don't disconnect yet
      // Azure SignalR will handle rate limiting automatically
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('[Webhook] Error handling abuse event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  /**
   * Health check for webhook endpoint
   */
  static healthCheck(req: Request, res: Response): void {
    res.json({
      status: 'ok',
      service: 'SignalR Webhook',
      timestamp: new Date().toISOString()
    });
  }
}
