import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { signalRConfig } from '../signalr/config';

export async function onConnected(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('SignalR onConnected function processed a request.');

  try {
    const body = await request.json() as any;
    const { userId, connectionId } = body;

    if (userId && connectionId) {
      context.log(`Processing connection for userId: ${userId}, connectionId: ${connectionId}`);
      
      // Get user type from request body or query params
      const userType = body.userType || 'dashboard';
      context.log(`User type determined: ${userType}`);
      
      // Since we broadcast to all users, we don't need complex group management
      context.log(`User ${userId} connected (${userType}) - using broadcast mode`);
      
      // Send welcome message to all users about the connection
      await signalRConfig.sendToDashboard({
        type: userType === 'device' ? 'device:connected' : 'user:connected',
        payload: { 
          userId, 
          userType,
          connectionId, 
          timestamp: new Date().toISOString() 
        }
      });
    }

    return {
      status: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    context.log('Error in onConnected function:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Failed to handle connection event' })
    };
  }
}

export async function onDisconnected(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('SignalR onDisconnected function processed a request.');

  try {
    const body = await request.json() as any;
    const { userId, connectionId } = body;

    if (userId && connectionId) {
      context.log(`Processing disconnection for userId: ${userId}, connectionId: ${connectionId}`);
      
      // Get user type from request body
      const userType = body.userType || 'dashboard';
      context.log(`User type determined: ${userType}`);
      
      // Since we broadcast to all users, we don't need complex group management
      context.log(`User ${userId} disconnected (${userType}) - using broadcast mode`);
      
      // Send disconnection notice to all users
      await signalRConfig.sendToDashboard({
        type: userType === 'device' ? 'device:disconnected' : 'user:disconnected',
        payload: { 
          userId, 
          userType,
          connectionId, 
          timestamp: new Date().toISOString() 
        }
      });
    }

    return {
      status: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    context.log('Error in onDisconnected function:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Failed to handle disconnection event' })
    };
  }
}

export async function onMessage(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('SignalR onMessage function processed a request.');

  try {
    const body = await request.json() as any;
    const { userId, message } = body;

    context.log(`Received message from ${userId}:`, message);

    // Handle different message types
    switch (message.type) {
      case 'PONG':
        // Handle ping/pong for keepalive
        context.log(`Received pong from ${userId}`);
        break;

      case 'DELIVERED':
        // Handle feedback delivery confirmation
        await signalRConfig.sendToDashboard({
          type: 'feedbackDelivered',
          payload: { userId, sessionId: message.payload?.sessionId }
        });
        break;

      case 'FEEDBACK_UPDATE':
        // Handle feedback updates
        await signalRConfig.sendToDashboard({
          type: 'feedbackUpdated',
          payload: { userId, ...message.payload }
        });
        break;

      case 'FEEDBACK_CANCELLED':
        // Handle feedback cancellation
        await signalRConfig.sendToDashboard({
          type: 'feedbackCancelled',
          payload: { userId, sessionId: message.payload?.sessionId }
        });
        break;

      default:
        context.log(`Unknown message type: ${message.type}`);
    }

    return {
      status: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    context.log('Error in onMessage function:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Failed to handle message' })
    };
  }
}

// Register the SignalR event functions
app.http('onConnected', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'signalr/connected',
  handler: onConnected
});

app.http('onDisconnected', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'signalr/disconnected',
  handler: onDisconnected
});

app.http('onMessage', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'signalr/message',
  handler: onMessage
});
