"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.negotiate = negotiate;
const functions_1 = require("@azure/functions");
const config_1 = require("../signalr/config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
/**
 * Azure Function for SignalR negotiate endpoint with App JWT authentication
 * This function validates App JWT tokens (signed by our backend) and generates SignalR connection info
 */
async function negotiate(request, context) {
    var _a;
    context.log('🚀 [SignalR Negotiate] Function started with App JWT validation.');
    context.log('🚀 [SignalR Negotiate] Request method:', request.method);
    context.log('🚀 [SignalR Negotiate] Request URL:', request.url);
    try {
        // Extract Bearer token from Authorization header - check both case variations
        const authHeader = request.headers.get('Authorization') ||
            request.headers.get('authorization') ||
            request.headers.get('AUTHORIZATION');
        context.log('🔍 [SignalR Negotiate] Auth header check:', {
            present: !!authHeader,
            startsWithBearer: authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer '),
            length: (authHeader === null || authHeader === void 0 ? void 0 : authHeader.length) || 0
        });
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            context.log('❌ [SignalR Negotiate] Missing or invalid Authorization header');
            context.log('❌ [SignalR Negotiate] All headers:', Object.fromEntries(request.headers.entries()));
            return {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Missing or invalid Authorization header',
                    message: 'Please provide a valid App JWT token in Authorization: Bearer <token> header'
                })
            };
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        context.log('🔑 [SignalR Negotiate] Token extracted, length:', token.length);
        context.log('🔑 [SignalR Negotiate] Token preview:', token.substring(0, 30) + '...');
        // Validate JWT token (verify App JWT signature)
        let jwtPayload;
        try {
            context.log('🔒 [SignalR Negotiate] Verifying App JWT with JWT_SECRET...');
            context.log('🔒 [SignalR Negotiate] JWT_SECRET present:', !!process.env.JWT_SECRET);
            // Verify App JWT token with our JWT_SECRET
            jwtPayload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            context.log('✅ [SignalR Negotiate] JWT verification successful');
            context.log('✅ [SignalR Negotiate] JWT payload claims:', {
                sub: jwtPayload.sub,
                typ: jwtPayload.typ,
                email: jwtPayload.email,
                iat: jwtPayload.iat,
                exp: jwtPayload.exp
            });
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
            context.log('✅ [SignalR Negotiate] App JWT validated successfully');
            context.log('✅ [SignalR Negotiate] Validated user:', jwtPayload.sub, 'type:', jwtPayload.typ);
        }
        catch (error) {
            context.log('❌ [SignalR Negotiate] JWT validation failed:', error);
            context.log('❌ [SignalR Negotiate] Error details:', error instanceof Error ? error.message : 'Unknown error');
            // Special handling for expired tokens
            if (error instanceof Error && error.name === 'TokenExpiredError') {
                context.log('🕒 [SignalR Negotiate] JWT token has expired');
                return {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        error: 'JWT_EXPIRED',
                        message: 'Your session has expired. Please log in again.',
                        code: 'TOKEN_EXPIRED'
                    })
                };
            }
            return {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Invalid App JWT token',
                    message: error instanceof Error ? error.message : 'Token validation failed',
                    code: 'TOKEN_INVALID'
                })
            };
        }
        // Create user identity for SignalR using App JWT claims
        const userId = jwtPayload.sub; // Use the staff/device ID directly
        const userEmail = jwtPayload.email || jwtPayload.employeeNo || 'Unknown';
        const userName = jwtPayload.name || jwtPayload.employeeNo || 'Unknown User';
        const tokenType = jwtPayload.typ; // 'staff' or 'device'
        // Extract user type from query params, headers, or token type (default to dashboard for staff)
        const userType = request.query.get('userType') ||
            request.headers.get('x-user-type') ||
            (tokenType === 'device' ? 'device' : 'dashboard');
        context.log('🎯 [SignalR Negotiate] Creating connection for:', {
            userId,
            userType,
            tokenType,
            userEmail
        });
        // Generate SignalR connection info based on user type
        let connectionInfo;
        let response;
        try {
            context.log('🔧 [SignalR Negotiate] Generating SignalR connection info...');
            context.log('🔧 [SignalR Negotiate] AZURE_SIGNALR_CONNECTION_STRING present:', !!process.env.AZURE_SIGNALR_CONNECTION_STRING);
            if (userType === 'device') {
                context.log('🔧 [SignalR Negotiate] Generating device connection info...');
                connectionInfo = (0, config_1.generateDeviceConnectionInfo)(userId);
            }
            else {
                context.log('🔧 [SignalR Negotiate] Generating dashboard connection info...');
                connectionInfo = (0, config_1.generateDashboardConnectionInfo)(userId);
            }
            context.log('✅ [SignalR Negotiate] Connection info generated:', {
                url: connectionInfo.url,
                accessTokenPresent: !!connectionInfo.accessToken,
                accessTokenLength: ((_a = connectionInfo.accessToken) === null || _a === void 0 ? void 0 : _a.length) || 0
            });
            // Since we broadcast to all users, no need for complex group management
            context.log('🔧 [SignalR Negotiate] Using broadcast mode - no group management needed');
            // Add user metadata as additional response fields
            response = {
                ...connectionInfo,
                user: {
                    id: userId,
                    email: userEmail,
                    name: userName,
                    type: userType
                }
            };
            context.log('✅ [SignalR Negotiate] Full response prepared for user:', userId);
            context.log('SignalR connection info generated successfully for user:', userId);
        }
        catch (configError) {
            context.log('ERROR in connection info generation:', configError);
            throw configError;
        }
        context.log(`Generated SignalR connection for ${userType}: ${userId}`);
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(response)
        };
    }
    catch (error) {
        context.log('Error in negotiate function:', error);
        context.log('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        return {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to generate SignalR connection',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
}
// Register the negotiate function
functions_1.app.http('negotiate', {
    methods: ['POST', 'GET'],
    authLevel: 'anonymous',
    route: 'negotiate', // Changed from 'signalr/negotiate' to 'negotiate' to match frontend requests
    handler: negotiate
});
//# sourceMappingURL=negotiate.js.map