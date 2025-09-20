"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessage = sendMessage;
const functions_1 = require("@azure/functions");
const signalr_1 = require("../signalr");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Azure Function for sending SignalR messages with App JWT authentication
 * This function validates App JWT tokens (signed by our backend) and allows authenticated users to send real-time messages
 */
async function sendMessage(request, context) {
    context.log('SignalR sendMessage function processing request with App JWT authentication.');
    try {
        // Extract Bearer token from Authorization header
        const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            context.log('ERROR: Missing or invalid Authorization header');
            return {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Missing or invalid Authorization header',
                    message: 'Please provide a valid JWT token in Authorization: Bearer <token> header'
                })
            };
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        // Validate App JWT token
        let jwtPayload;
        try {
            // Verify App JWT token with our JWT_SECRET
            jwtPayload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            if (!jwtPayload || typeof jwtPayload !== 'object') {
                throw new Error('Invalid token format');
            }
            // Validate required App JWT claims
            if (!jwtPayload.sub || !jwtPayload.typ) {
                throw new Error('Missing required claims (sub, typ)');
            }
            // Validate token type (should be 'staff' or 'device')
            if (!['staff', 'device'].includes(jwtPayload.typ)) {
                throw new Error(`Invalid token type. Expected 'staff' or 'device', got: ${jwtPayload.typ}`);
            }
            context.log(`App JWT validated for user: ${jwtPayload.sub}, type: ${jwtPayload.typ}`);
        }
        catch (error) {
            context.log('ERROR: JWT validation failed:', error);
            return {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Invalid App JWT token',
                    message: error instanceof Error ? error.message : 'Token validation failed'
                })
            };
        }
        // Parse request body
        const body = await request.json();
        const { target, message, userId, groupName, deviceId } = body;
        if (!target || !message) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Target and message are required' })
            };
        }
        // Create sender identity
        const senderId = `azure-ad|${jwtPayload.sub}`;
        const senderEmail = jwtPayload.upn || jwtPayload.email || jwtPayload.preferred_username;
        context.log(`Sending message from user: ${senderId}, target: ${target}`);
        // Send message based on target type using SignalRGateway
        try {
            switch (target) {
                case 'user':
                    // Note: SignalR doesn't have direct user targeting, use device or dashboard
                    return {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            error: 'User targeting not directly supported in SignalR. Use device or dashboard target instead.'
                        })
                    };
                case 'group':
                    // Note: Group messaging would need to be implemented through device filtering
                    return {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            error: 'Group targeting not directly supported. Use dashboard or device target instead.'
                        })
                    };
                case 'device':
                    const targetDeviceId = deviceId || userId;
                    if (!targetDeviceId) {
                        return {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ error: 'deviceId or userId is required for device target' })
                        };
                    }
                    // Convert message to ServerToDevice format
                    const deviceMessage = {
                        type: message.type || message.method || 'message',
                        payload: message.data || message.payload || message
                    };
                    const deviceSent = await signalr_1.SignalRGateway.sendToDevice(targetDeviceId, deviceMessage);
                    if (!deviceSent) {
                        throw new Error(`Failed to send message to device ${targetDeviceId} (device may be offline)`);
                    }
                    context.log(`Message sent to device: ${targetDeviceId}`);
                    break;
                case 'dashboard':
                    // Convert message to dashboard notification format
                    const dashboardMessage = {
                        type: message.type || message.method || 'message',
                        payload: message.data || message.payload || message
                    };
                    await signalr_1.SignalRGateway.notifyDashboard(dashboardMessage);
                    context.log('Message sent to dashboard');
                    break;
                case 'all':
                    // Broadcast to all devices
                    const broadcastMessage = {
                        type: message.type || message.method || 'message',
                        payload: message.data || message.payload || message
                    };
                    await signalr_1.SignalRGateway.broadcastToDevices(broadcastMessage);
                    context.log('Message broadcasted to all devices');
                    break;
                default:
                    return {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            error: 'Invalid target. Must be device, dashboard, or all'
                        })
                    };
            }
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    message: 'Message sent successfully',
                    sender: {
                        id: senderId,
                        email: senderEmail
                    },
                    target: target,
                    timestamp: new Date().toISOString()
                })
            };
        }
        catch (signalRError) {
            context.log('ERROR: Failed to send SignalR message:', signalRError);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Failed to send message through SignalR',
                    details: signalRError instanceof Error ? signalRError.message : 'Unknown SignalR error'
                })
            };
        }
    }
    catch (error) {
        context.log('Error in sendMessage function:', error);
        context.log('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        return {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
}
// Register the sendMessage function
functions_1.app.http('sendMessage', {
    methods: ['POST'],
    authLevel: 'function',
    route: 'signalr/send',
    handler: sendMessage
});
//# sourceMappingURL=sendMessage.js.map