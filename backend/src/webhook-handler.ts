import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { SignalRGateway } from './signalr';
import { verifySignalRToken } from './signalr/auth';

// Azure Web PubSub webhook handler
export async function webhookHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Web PubSub webhook: ${request.method} ${request.url}`);

  try {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, WebHook-Request-Origin',
          'Access-Control-Max-Age': '86400'
        }
      };
    }

    // Verify webhook request origin
    const webhookOrigin = request.headers.get('WebHook-Request-Origin');
    if (!webhookOrigin || !webhookOrigin.includes('webpubsub.azure.com')) {
      context.log('Invalid webhook origin:', webhookOrigin);
      return { status: 401, body: 'Unauthorized' };
    }

    // Get the webhook event data
    const eventData = await request.json() as any;
    context.log('Webhook event:', eventData.type);

    // Route the webhook event
    switch (eventData.type) {
      case 'system':
        return await handleSystemEvent(eventData, context);
      
      case 'user':
        return await handleUserEvent(eventData, context);
      
      default:
        context.log('Unknown webhook event type:', eventData.type);
        return { status: 200, body: 'OK' };
    }
  } catch (error) {
    context.log('Webhook handler error:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' })
    };
  }
}

// Handle system events (connect/disconnect)
async function handleSystemEvent(eventData: any, context: InvocationContext): Promise<HttpResponseInit> {
  const { eventName, connectionId, userId } = eventData;

  try {
    switch (eventName) {
      case 'connected':
        context.log(`Connection established: ${connectionId} for user: ${userId}`);
        
        // Determine if this is a device or dashboard connection
        if (userId?.startsWith('device-')) {
          const deviceId = userId.replace('device-', '');
          // Get device mode from connection context or default to REGISTRATION
          const mode = 'REGISTRATION'; // You might want to extract this from token
          await SignalRGateway.handleDeviceConnect(deviceId, connectionId, mode);
        } else if (userId) {
          await SignalRGateway.handleDashboardConnect(connectionId, userId);
        }
        break;

      case 'disconnected':
        context.log(`Connection closed: ${connectionId} for user: ${userId}`);
        
        if (userId?.startsWith('device-')) {
          const deviceId = userId.replace('device-', '');
          await SignalRGateway.handleDeviceDisconnect(deviceId, connectionId);
        } else if (userId) {
          await SignalRGateway.handleDashboardDisconnect(connectionId);
        }
        break;

      default:
        context.log('Unknown system event:', eventName);
    }

    return { status: 200, body: 'OK' };
  } catch (error) {
    context.log('System event handling error:', error);
    return { status: 500, body: 'Error handling system event' };
  }
}

// Handle user events (messages)
async function handleUserEvent(eventData: any, context: InvocationContext): Promise<HttpResponseInit> {
  const { connectionId, userId, data } = eventData;

  try {
    context.log(`User message from ${userId} (${connectionId}):`, data);

    // Parse the message
    let message;
    if (typeof data === 'string') {
      try {
        message = JSON.parse(data);
      } catch {
        message = { type: 'raw', payload: data };
      }
    } else {
      message = data;
    }

    // Route message based on user type
    if (userId?.startsWith('device-')) {
      const deviceId = userId.replace('device-', '');
      await SignalRGateway.handleDeviceMessage(deviceId, message);
    } else {
      // Dashboard messages - might need special handling
      context.log('Dashboard message received:', message);
    }

    return { status: 200, body: 'OK' };
  } catch (error) {
    context.log('User event handling error:', error);
    return { status: 500, body: 'Error handling user event' };
  }
}

// Validate Azure Web PubSub webhook signature (optional security)
function validateWebhookSignature(request: HttpRequest, secret: string): boolean {
  // Implementation depends on your security requirements
  // Azure Web PubSub can be configured to include signatures
  return true;
}

// Register the webhook function
app.http('webhooks', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'webhooks/{*restOfPath}',
  handler: webhookHandler
});

export { handleSystemEvent, handleUserEvent };
