import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { signalRConfig } from '../signalr/config';

export async function onConnected(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('SignalR onConnected function processed a request.');

  try {
    const body = await request.json() as any;
    const { userId, connectionId } = body;

    if (userId && connectionId) {
      // Add user to appropriate groups based on user type
      if (userId.startsWith('device-')) {
        await signalRConfig.addUserToGroup(userId, 'devices');
        context.log(`Device ${userId} connected and added to devices group`);
      } else {
        await signalRConfig.addUserToGroup(userId, 'dashboard');
        context.log(`User ${userId} connected and added to dashboard group`);
      }

      // Notify dashboard about new connection
      await signalRConfig.sendToDashboard({
        type: 'userConnected',
        payload: { userId, connectionId, timestamp: new Date().toISOString() }
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
      // Remove user from groups
      if (userId.startsWith('device-')) {
        await signalRConfig.removeUserFromGroup(userId, 'devices');
        context.log(`Device ${userId} disconnected and removed from devices group`);
      } else {
        await signalRConfig.removeUserFromGroup(userId, 'dashboard');
        context.log(`User ${userId} disconnected and removed from dashboard group`);
      }

      // Notify dashboard about disconnection
      await signalRConfig.sendToDashboard({
        type: 'userDisconnected',
        payload: { userId, connectionId, timestamp: new Date().toISOString() }
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
