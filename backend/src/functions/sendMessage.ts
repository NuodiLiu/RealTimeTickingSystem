import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { signalRConfig } from '../signalr/config';

export async function sendMessage(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('SignalR sendMessage function processed a request.');

  try {
    const body = await request.json() as any;
    const { target, message, userId, groupName } = body;

    if (!target || !message) {
      return {
        status: 400,
        body: JSON.stringify({ error: 'Target and message are required' })
      };
    }

    switch (target) {
      case 'user':
        if (!userId) {
          return {
            status: 400,
            body: JSON.stringify({ error: 'userId is required for user target' })
          };
        }
        await signalRConfig.sendToUser(userId, message);
        context.log(`Message sent to user: ${userId}`);
        break;

      case 'group':
        if (!groupName) {
          return {
            status: 400,
            body: JSON.stringify({ error: 'groupName is required for group target' })
          };
        }
        await signalRConfig.sendToGroup(groupName, message);
        context.log(`Message sent to group: ${groupName}`);
        break;

      case 'device':
        if (!userId) {
          return {
            status: 400,
            body: JSON.stringify({ error: 'userId (deviceId) is required for device target' })
          };
        }
        await signalRConfig.sendToDevice(userId, message);
        context.log(`Message sent to device: ${userId}`);
        break;

      case 'dashboard':
        await signalRConfig.sendToDashboard(message);
        context.log('Message sent to dashboard');
        break;

      default:
        return {
          status: 400,
          body: JSON.stringify({ error: 'Invalid target. Must be user, group, device, or dashboard' })
        };
    }

    return {
      status: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    context.log('Error in sendMessage function:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Failed to send message' })
    };
  }
}

// Register the sendMessage function
app.http('sendMessage', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'signalr/send',
  handler: sendMessage
});
