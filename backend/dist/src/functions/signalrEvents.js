"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onConnected = onConnected;
exports.onDisconnected = onDisconnected;
exports.onMessage = onMessage;
const functions_1 = require("@azure/functions");
const config_1 = require("../signalr/config");
async function onConnected(request, context) {
    context.log('SignalR onConnected function processed a request.');
    try {
        const body = await request.json();
        const { userId, connectionId } = body;
        if (userId && connectionId) {
            context.log(`Processing connection for userId: ${userId}, connectionId: ${connectionId}`);
            // Get user type from request body or query params
            const userType = body.userType || 'dashboard';
            context.log(`User type determined: ${userType}`);
            // Since we broadcast to all users, we don't need complex group management
            context.log(`User ${userId} connected (${userType}) - using broadcast mode`);
            // Send welcome message to all users about the connection
            await config_1.signalRConfig.sendToDashboard({
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
    }
    catch (error) {
        context.log('Error in onConnected function:', error);
        return {
            status: 500,
            body: JSON.stringify({ error: 'Failed to handle connection event' })
        };
    }
}
async function onDisconnected(request, context) {
    context.log('SignalR onDisconnected function processed a request.');
    try {
        const body = await request.json();
        const { userId, connectionId } = body;
        if (userId && connectionId) {
            context.log(`Processing disconnection for userId: ${userId}, connectionId: ${connectionId}`);
            // Get user type from request body
            const userType = body.userType || 'dashboard';
            context.log(`User type determined: ${userType}`);
            // Since we broadcast to all users, we don't need complex group management
            context.log(`User ${userId} disconnected (${userType}) - using broadcast mode`);
            // Send disconnection notice to all users
            await config_1.signalRConfig.sendToDashboard({
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
    }
    catch (error) {
        context.log('Error in onDisconnected function:', error);
        return {
            status: 500,
            body: JSON.stringify({ error: 'Failed to handle disconnection event' })
        };
    }
}
async function onMessage(request, context) {
    var _a, _b;
    context.log('SignalR onMessage function processed a request.');
    try {
        const body = await request.json();
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
                await config_1.signalRConfig.sendToDashboard({
                    type: 'feedbackDelivered',
                    payload: { userId, sessionId: (_a = message.payload) === null || _a === void 0 ? void 0 : _a.sessionId }
                });
                break;
            case 'FEEDBACK_UPDATE':
                // Handle feedback updates
                await config_1.signalRConfig.sendToDashboard({
                    type: 'feedbackUpdated',
                    payload: { userId, ...message.payload }
                });
                break;
            case 'FEEDBACK_CANCELLED':
                // Handle feedback cancellation
                await config_1.signalRConfig.sendToDashboard({
                    type: 'feedbackCancelled',
                    payload: { userId, sessionId: (_b = message.payload) === null || _b === void 0 ? void 0 : _b.sessionId }
                });
                break;
            default:
                context.log(`Unknown message type: ${message.type}`);
        }
        return {
            status: 200,
            body: JSON.stringify({ success: true })
        };
    }
    catch (error) {
        context.log('Error in onMessage function:', error);
        return {
            status: 500,
            body: JSON.stringify({ error: 'Failed to handle message' })
        };
    }
}
// Register the SignalR event functions
functions_1.app.http('onConnected', {
    methods: ['POST'],
    authLevel: 'function',
    route: 'signalr/connected',
    handler: onConnected
});
functions_1.app.http('onDisconnected', {
    methods: ['POST'],
    authLevel: 'function',
    route: 'signalr/disconnected',
    handler: onDisconnected
});
functions_1.app.http('onMessage', {
    methods: ['POST'],
    authLevel: 'function',
    route: 'signalr/message',
    handler: onMessage
});
//# sourceMappingURL=signalrEvents.js.map