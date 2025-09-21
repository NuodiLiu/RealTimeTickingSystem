"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSignalR = testSignalR;
// Simple test endpoint to send messages
const functions_1 = require("@azure/functions");
const config_1 = require("../signalr/config");
async function testSignalR(request, context) {
    context.log('🧪 [TEST ENDPOINT] SignalR test function called');
    try {
        const body = await request.json();
        const { deviceId, messageType } = body;
        if (!deviceId) {
            return {
                status: 400,
                body: JSON.stringify({ error: 'deviceId required' })
            };
        }
        context.log(`📤 [TEST ENDPOINT] Sending ${messageType || 'test'} message to device: ${deviceId}`);
        if (messageType === 'unpair') {
            // Send unpair message
            const unpairMessage = {
                type: 'UNPAIRED'
            };
            await config_1.signalRConfig.sendToUser(deviceId, unpairMessage);
            context.log('✅ [TEST ENDPOINT] Unpair message sent');
        }
        else {
            // Send test feedback message
            const testMessage = {
                type: 'SHOW_FEEDBACK',
                payload: {
                    sessionId: 'test-session-' + Date.now(),
                    caseId: 'test-case-456',
                    staff: {
                        id: 'test-staff-789',
                        name: 'Test Staff from API'
                    },
                    expireAt: new Date(Date.now() + 300000).toISOString() // 5 minutes from now
                }
            };
            await config_1.signalRConfig.sendToUser(deviceId, testMessage);
            context.log('✅ [TEST ENDPOINT] Test feedback message sent');
        }
        return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: `${messageType || 'test'} message sent to device ${deviceId}`
            })
        };
    }
    catch (error) {
        context.log('❌ [TEST ENDPOINT] Error:', error);
        return {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to send message',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
}
functions_1.app.http('testSignalR', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'test-signalr',
    handler: testSignalR,
});
//# sourceMappingURL=testSignalR.js.map