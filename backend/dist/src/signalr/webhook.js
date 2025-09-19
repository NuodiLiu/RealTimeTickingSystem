"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebPubSubEvent = handleWebPubSubEvent;
exports.setupWebPubSubWebhooks = setupWebPubSubWebhooks;
const index_1 = require("./index");
const auth_1 = require("./auth");
async function handleWebPubSubEvent(req, res) {
    try {
        const event = req.body;
        console.log('Received Web PubSub event:', event.type, event.eventType);
        switch (event.type) {
            case 'connect':
                await handleConnectEvent(event, res);
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
                await handleMessageEvent(event);
                res.status(200).send();
                break;
            default:
                console.warn('Unknown event type:', event.type);
                res.status(200).send();
        }
    }
    catch (error) {
        console.error('Error handling Web PubSub event:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
async function handleConnectEvent(event, res) {
    var _a, _b, _c;
    try {
        // Extract authentication token from query or headers
        const token = ((_a = event.query) === null || _a === void 0 ? void 0 : _a.access_token) || ((_c = (_b = event.headers) === null || _b === void 0 ? void 0 : _b.authorization) === null || _c === void 0 ? void 0 : _c.replace('Bearer ', ''));
        if (!token) {
            return res.status(401).json({ error: 'Authentication token required' });
        }
        // Verify the token
        const decoded = (0, auth_1.verifySignalRToken)(token);
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid authentication token' });
        }
        // Allow the connection
        res.status(200).json({});
    }
    catch (error) {
        console.error('Error in connect event:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
}
async function handleConnectedEvent(event) {
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
            const mode = 'REGISTRATION';
            await index_1.SignalRGateway.handleDeviceConnect(deviceId, event.connectionId, mode);
        }
        else {
            // This is a dashboard connection
            await index_1.SignalRGateway.handleDashboardConnect(event.connectionId, userId);
        }
    }
    catch (error) {
        console.error('Error in connected event:', error);
    }
}
async function handleDisconnectedEvent(event) {
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
            await index_1.SignalRGateway.handleDeviceDisconnect(deviceId, event.connectionId);
        }
        else {
            // This is a dashboard disconnection
            await index_1.SignalRGateway.handleDashboardDisconnect(event.connectionId);
        }
    }
    catch (error) {
        console.error('Error in disconnected event:', error);
    }
}
async function handleMessageEvent(event) {
    try {
        const userId = event.fromUserId;
        if (!userId) {
            console.warn('Message event without fromUserId');
            return;
        }
        // Only handle messages from devices (dashboard messages are not expected)
        if (userId.startsWith('device-') || userId.length === 8) {
            const deviceId = userId.startsWith('device-') ? userId.replace('device-', '') : userId;
            await index_1.SignalRGateway.handleDeviceMessage(deviceId, event.data);
        }
    }
    catch (error) {
        console.error('Error in message event:', error);
    }
}
// Webhook route setup
function setupWebPubSubWebhooks(app) {
    // Handle Web PubSub events
    app.post('/api/signalr/webhook', handleWebPubSubEvent);
    // Health check for webhook endpoint
    app.get('/api/signalr/webhook/health', (req, res) => {
        res.json({
            status: 'ok',
            service: 'SignalR Webhook Handler',
            timestamp: new Date().toISOString()
        });
    });
}
//# sourceMappingURL=webhook.js.map