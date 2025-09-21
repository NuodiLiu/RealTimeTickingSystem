"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testBroadcast = testBroadcast;
const functions_1 = require("@azure/functions");
const signalr_1 = require("../signalr");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Azure Function for testing SignalR broadcast to all devices
 * This is a simple test endpoint to verify that SignalR broadcasting works
 */
async function testBroadcast(request, context) {
    context.log('🧪 [Test Broadcast] Starting broadcast test to all devices');
    try {
        // Simple auth check - require any valid JWT
        const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            context.log('❌ [Test Broadcast] Missing Authorization header');
            return {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Authorization required',
                    message: 'Please provide a JWT token in Authorization: Bearer <token> header'
                })
            };
        }
        const token = authHeader.substring(7);
        // Validate JWT token
        try {
            const jwtPayload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            context.log(`✅ [Test Broadcast] JWT validated for user: ${jwtPayload.sub}`);
        }
        catch (error) {
            context.log('❌ [Test Broadcast] JWT validation failed:', error);
            return {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Invalid JWT token',
                    message: 'Token validation failed'
                })
            };
        }
        // Get test message from request body or use default
        let testMessage;
        try {
            const requestBody = await request.text();
            if (requestBody) {
                testMessage = JSON.parse(requestBody);
            }
        }
        catch (error) {
            // Use default if parsing fails
        }
        // Create broadcast test message
        const broadcastMessage = {
            type: (testMessage === null || testMessage === void 0 ? void 0 : testMessage.type) || "deviceUpdated",
            payload: (testMessage === null || testMessage === void 0 ? void 0 : testMessage.payload) || {
                id: "broadcast-test",
                status: "BROADCAST_TEST",
                timestamp: new Date().toISOString(),
                message: "This is a test broadcast to all devices"
            }
        };
        context.log('📤 [Test Broadcast] Sending message:', JSON.stringify(broadcastMessage, null, 2));
        // Use the existing broadcastToDevices method
        await signalr_1.SignalRGateway.broadcastToDevices(broadcastMessage);
        context.log('✅ [Test Broadcast] Message sent successfully to all devices');
        return {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Broadcast test message sent to all devices',
                sentMessage: broadcastMessage,
                timestamp: new Date().toISOString()
            })
        };
    }
    catch (error) {
        context.log('❌ [Test Broadcast] Error:', error);
        return {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to send broadcast test message',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
}
// Register the function
functions_1.app.http('testBroadcast', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'test/broadcast',
    handler: testBroadcast
});
//# sourceMappingURL=testBroadcast.js.map