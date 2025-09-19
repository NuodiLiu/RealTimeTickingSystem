import { Request, Response } from 'express';
import { SignalRGateway } from './index';
import { verifySignalRToken } from './auth';
import { DeviceMode } from './types';

/**
 * Azure Web PubSub Webhook Handler
 * Handles events from Azure Web PubSub service
 */

interface WebPubSubEvent {
  type: 'connect' | 'connected' | 'disconnected' | 'message';
  eventType: string;
  hub: string;
  connectionId: string;
  userId?: string;
  data?: any;
  dataType?: string;
}

interface ConnectEventData extends WebPubSubEvent {
  type: 'connect';
  claims?: Record<string, any>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}

interface MessageEventData extends WebPubSubEvent {
  type: 'message';
  fromUserId?: string;
  data: any;
}

export async function handleWebPubSubEvent(req: Request, res: Response) {
  try {
    const event = req.body as WebPubSubEvent;
    
    console.log('Received Web PubSub event:', event.type, event.eventType);
    
    switch (event.type) {
      case 'connect':
        await handleConnectEvent(event as ConnectEventData, res);
        break;
      
      case 'connected':
        await handleConnectedEvent(event);
        res.status(200).send();
        break;
      
      case 'disconnected':
        await handleDisconnectedEvent(event);
        res.status(200).send();
        break;
      
      case 'message':
        await handleMessageEvent(event as MessageEventData);
        res.status(200).send();
        break;
      
      default:
        console.warn('Unknown event type:', event.type);
        res.status(200).send();
    }
  } catch (error) {
    console.error('Error handling Web PubSub event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleConnectEvent(event: ConnectEventData, res: Response) {
  try {
    // Extract authentication token from query or headers
    const token = event.query?.access_token || event.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }
    
    // Verify the token
    const decoded = verifySignalRToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    
    // Allow the connection
    res.status(200).json({});
    
  } catch (error) {
    console.error('Error in connect event:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

async function handleConnectedEvent(event: WebPubSubEvent) {
  try {
    // Extract user info from the event
    const userId = event.userId;
    
    if (!userId) {
      console.warn('Connected event without userId');
      return;
    }
    
    // Determine if this is a device or dashboard connection based on userId format
    if (userId.startsWith('device-') || userId.length === 8) {
      // This is a device connection
      const deviceId = userId.startsWith('device-') ? userId.replace('device-', '') : userId;
      
      // For now, default to REGISTRATION mode - this should come from the connection token
      const mode: DeviceMode = 'REGISTRATION';
      
      await SignalRGateway.handleDeviceConnect(deviceId, event.connectionId, mode);
    } else {
      // This is a dashboard connection
      await SignalRGateway.handleDashboardConnect(event.connectionId, userId);
    }
    
  } catch (error) {
    console.error('Error in connected event:', error);
  }
}

async function handleDisconnectedEvent(event: WebPubSubEvent) {
  try {
    const userId = event.userId;
    
    if (!userId) {
      console.warn('Disconnected event without userId');
      return;
    }
    
    // Determine if this is a device or dashboard disconnection
    if (userId.startsWith('device-') || userId.length === 8) {
      // This is a device disconnection
      const deviceId = userId.startsWith('device-') ? userId.replace('device-', '') : userId;
      await SignalRGateway.handleDeviceDisconnect(deviceId);
    } else {
      // This is a dashboard disconnection
      await SignalRGateway.handleDashboardDisconnect(event.connectionId);
    }
    
  } catch (error) {
    console.error('Error in disconnected event:', error);
  }
}

async function handleMessageEvent(event: MessageEventData) {
  try {
    const userId = event.fromUserId;
    
    if (!userId) {
      console.warn('Message event without fromUserId');
      return;
    }
    
    // Only handle messages from devices (dashboard messages are not expected)
    if (userId.startsWith('device-') || userId.length === 8) {
      const deviceId = userId.startsWith('device-') ? userId.replace('device-', '') : userId;
      await SignalRGateway.handleDeviceMessage(deviceId, event.data);
    }
    
  } catch (error) {
    console.error('Error in message event:', error);
  }
}

// Webhook route setup
export function setupWebPubSubWebhooks(app: any) {
  // Handle Web PubSub events
  app.post('/api/signalr/webhook', handleWebPubSubEvent);
  
  // Health check for webhook endpoint
  app.get('/api/signalr/webhook/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      service: 'SignalR Webhook Handler',
      timestamp: new Date().toISOString()
    });
  });
}
