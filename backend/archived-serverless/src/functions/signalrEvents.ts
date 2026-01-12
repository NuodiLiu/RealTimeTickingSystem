// import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
// import { signalRConfig } from '../signalr/config';

// export async function onConnected(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
//   context.log('SignalR onConnected function processed a request.');

//   try {
//     const body = await request.json() as any;
//     const { userId, connectionId } = body;

//     context.log('Event body received:', body); // 添加调试日志

//     if (userId && connectionId) {
//       context.log(`Processing connection for userId: ${userId}, connectionId: ${connectionId}`);
      
//       // Get user type from request body or query params
//       const userType = body.userType || 'dashboard';
//       context.log(`User type determined: ${userType}`);
      
//       // Since we broadcast to all users, we don't need complex group management
//       context.log(`User ${userId} connected (${userType}) - using broadcast mode`);
      
//       // Send welcome message to all users about the connection
//       await signalRConfig.sendToDashboard({
//         type: userType === 'device' ? 'device:connected' : 'user:connected',
//         payload: { 
//           userId, 
//           userType,
//           connectionId, 
//           timestamp: new Date().toISOString() 
//         }
//       });
//     } else {
//       context.log('Missing userId or connectionId in event body');
//     }

//     return {
//       status: 200,
//       body: JSON.stringify({ success: true })
//     };

//   } catch (error) {
//     context.log('Error in onConnected function:', error);
//     return {
//       status: 500,
//       body: JSON.stringify({ error: 'Failed to handle connection event' })
//     };
//   }
// }

// export async function onDisconnected(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
//   context.log('SignalR onDisconnected function processed a request.');

//   try {
//     const body = await request.json() as any;
//     const { userId, connectionId } = body;

//     if (userId && connectionId) {
//       context.log(`Processing disconnection for userId: ${userId}, connectionId: ${connectionId}`);
      
//       // Get user type from request body
//       const userType = body.userType || 'dashboard';
//       context.log(`User type determined: ${userType}`);
      
//       // Since we broadcast to all users, we don't need complex group management
//       context.log(`User ${userId} disconnected (${userType}) - using broadcast mode`);
      
//       // Send disconnection notice to all users
//       await signalRConfig.sendToDashboard({
//         type: userType === 'device' ? 'device:disconnected' : 'user:disconnected',
//         payload: { 
//           userId, 
//           userType,
//           connectionId, 
//           timestamp: new Date().toISOString() 
//         }
//       });
//     }

//     return {
//       status: 200,
//       body: JSON.stringify({ success: true })
//     };

//   } catch (error) {
//     context.log('Error in onDisconnected function:', error);
//     return {
//       status: 500,
//       body: JSON.stringify({ error: 'Failed to handle disconnection event' })
//     };
//   }
// }

// export async function onMessage(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
//   context.log('SignalR onMessage function processed a request.');

//   try {
//     const body = await request.json() as any;
//     const { userId, message } = body;

//     context.log(`Received message from ${userId}:`, message);

//     // Handle different message types
//     switch (message.type) {
//       case 'PONG':
//         // Handle ping/pong for keepalive
//         context.log(`Received pong from ${userId}`);
//         break;

//       case 'DELIVERED':
//         // Handle feedback delivery confirmation
//         await signalRConfig.sendToDashboard({
//           type: 'feedbackDelivered',
//           payload: { userId, sessionId: message.payload?.sessionId }
//         });
//         break;

//       case 'FEEDBACK_UPDATE':
//         // Handle feedback updates
//         await signalRConfig.sendToDashboard({
//           type: 'feedbackUpdated',
//           payload: { userId, ...message.payload }
//         });
//         break;

//       case 'FEEDBACK_CANCELLED':
//         // Handle feedback cancellation
//         await signalRConfig.sendToDashboard({
//           type: 'feedbackCancelled',
//           payload: { userId, sessionId: message.payload?.sessionId }
//         });
//         break;

//       default:
//         context.log(`Unknown message type: ${message.type}`);
//     }

//     return {
//       status: 200,
//       body: JSON.stringify({ success: true })
//     };

//   } catch (error) {
//     context.log('Error in onMessage function:', error);
//     return {
//       status: 500,
//       body: JSON.stringify({ error: 'Failed to handle message' })
//     };
//   }
// }

// // Register the SignalR event functions
// app.http('onConnected', {
//   methods: ['POST'],
//   authLevel: 'function',
//   route: 'signalr/connected',
//   handler: onConnected
// });

// app.http('onDisconnected', {
//   methods: ['POST'],
//   authLevel: 'function',
//   route: 'signalr/disconnected',
//   handler: onDisconnected
// });

// app.http('onMessage', {
//   methods: ['POST'],
//   authLevel: 'function',
//   route: 'signalr/message',
//   handler: onMessage
// });
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { signalRConfig } from '../signalr/config';

function qs(req: HttpRequest) {
  const raw = req.headers.get('x-asrs-client-query') || '';
  return new URLSearchParams(raw);
}

function h(req: HttpRequest, name: string) {
  return req.headers.get(name) || '';
}

export async function onConnected(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('SignalR onConnected');

  // 连接/断开事件的信息来自请求头
  const connectionId = h(request, 'x-asrs-connection-id');
  const userId = h(request, 'x-asrs-user-id') || qs(request).get('userId') || '';
  const userType = qs(request).get('userType') || 'dashboard';

  context.log({ connectionId, userId, userType });

  // 广播给控制台（或你定义的 hub）
  await signalRConfig.sendToDashboard({
    type: userType === 'device' ? 'device:connected' : 'user:connected',
    payload: { userId, userType, connectionId, timestamp: new Date().toISOString() },
  });

  return { status: 200, body: JSON.stringify({ success: true }) };
}

export async function onDisconnected(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('SignalR onDisconnected');

  const connectionId = h(request, 'x-asrs-connection-id');
  const userId = h(request, 'x-asrs-user-id') || qs(request).get('userId') || '';
  const userType = qs(request).get('userType') || 'dashboard';

  let body: any = {};
  try { body = await request.json(); } catch { /* connected/disconnected 可能为空 */ }

  await signalRConfig.sendToDashboard({
    type: userType === 'device' ? 'device:disconnected' : 'user:disconnected',
    payload: { userId, userType, connectionId, error: body?.Error ?? null, timestamp: new Date().toISOString() },
  });

  return { status: 200, body: JSON.stringify({ success: true }) };
}

export async function onMessage(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('SignalR onMessage');

  const connectionId = h(request, 'x-asrs-connection-id');
  const userId = h(request, 'x-asrs-user-id') || qs(request).get('userId') || '';

  let body: any = {};
  try { body = await request.json(); } catch { /* no-op */ }

  // Upstream Invocation 格式：Target + Arguments
  const target = body?.Target ?? body?.target;
  const args = body?.Arguments ?? body?.arguments ?? [];

  // 兼容你原来的 envelope：客户端把 { userId, message } 作为第一个参数发过来
  const arg0 = args[0] ?? {};
  const msg = (arg0 && arg0.message) ? arg0.message : arg0;

  context.log('Upstream message:', { target, argsCount: args.length, envelope: msg });

  switch ((msg?.type || target || '').toUpperCase()) {
    case 'PONG':
      context.log(`PONG from ${userId || connectionId}`);
      break;

    case 'DELIVERED':
      await signalRConfig.sendToDashboard({
        type: 'feedbackDelivered',
        payload: { userId, sessionId: msg?.payload?.sessionId },
      });
      break;

    case 'FEEDBACK_UPDATE':
      await signalRConfig.sendToDashboard({
        type: 'feedbackUpdated',
        payload: { userId, ...msg?.payload },
      });
      break;

    case 'FEEDBACK_CANCELLED':
      await signalRConfig.sendToDashboard({
        type: 'feedbackCancelled',
        payload: { userId, sessionId: msg?.payload?.sessionId },
      });
      break;

    default:
      context.log(`Unknown target/type: ${target} / ${msg?.type}`);
  }

  return { status: 200, body: JSON.stringify({ success: true }) };
}

// 保留你原来的三条路由（注意 Upstream URL 要带 ?code=...）
app.http('onConnected',    { methods: ['POST'], authLevel: 'function', route: 'signalr/connected',    handler: onConnected });
app.http('onDisconnected', { methods: ['POST'], authLevel: 'function', route: 'signalr/disconnected', handler: onDisconnected });
app.http('onMessage',      { methods: ['POST'], authLevel: 'function', route: 'signalr/message',      handler: onMessage });
