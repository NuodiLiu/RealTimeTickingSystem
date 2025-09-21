"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signalrTest = signalrTest;
const functions_1 = require("@azure/functions");
const config_1 = require("../signalr/config");
async function signalrTest(request, context) {
    context.log('🧪 [SignalR Test] HTTP trigger function processed a request.');
    if (request.method === 'POST') {
        try {
            const body = await request.json();
            const { deviceId, messageType, payload } = body;
            if (!deviceId || !messageType) {
                return {
                    status: 400,
                    jsonBody: { error: 'deviceId and messageType are required' }
                };
            }
            context.log(`🧪 [SignalR Test] Sending ${messageType} to device: ${deviceId}`);
            context.log(`🧪 [SignalR Test] Payload:`, JSON.stringify(payload, null, 2));
            // Create message in the format expected by SignalR config
            const message = {
                type: messageType,
                payload: payload || {}
            };
            // Send the message
            await config_1.signalRConfig.sendToUser(deviceId, message);
            context.log(`✅ [SignalR Test] Message sent successfully to device: ${deviceId}`);
            return {
                status: 200,
                jsonBody: {
                    success: true,
                    message: `${messageType} sent to device ${deviceId}`,
                    timestamp: new Date().toISOString()
                }
            };
        }
        catch (error) {
            context.log(`❌ [SignalR Test] Error sending message:`, error);
            return {
                status: 500,
                jsonBody: {
                    error: 'Failed to send SignalR message',
                    details: error instanceof Error ? error.message : 'Unknown error'
                }
            };
        }
    }
    else {
        return {
            status: 405,
            jsonBody: { error: 'Method not allowed. Use POST.' }
        };
    }
}
functions_1.app.http('signalrTest', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: signalrTest
});
//# sourceMappingURL=signalr-test.js.map