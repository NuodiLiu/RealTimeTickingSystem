"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureSignalRServiceConfig = exports.signalRConfig = void 0;
exports.validateSignalREnvironment = validateSignalREnvironment;
exports.generateDeviceConnectionInfo = generateDeviceConnectionInfo;
exports.generateDashboardConnectionInfo = generateDashboardConnectionInfo;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class AzureSignalRServiceConfig {
    constructor() {
        const connectionString = process.env.AZURE_SIGNALR_CONNECTION_STRING;
        if (!connectionString) {
            throw new Error('AZURE_SIGNALR_CONNECTION_STRING environment variable is required');
        }
        this.connectionString = connectionString;
        this.hubName = process.env.AZURE_SIGNALR_HUB_NAME || 'realtimeticket';
        // Parse connection string to extract endpoint and access key
        const parsed = this.parseConnectionString(this.connectionString);
        this.endpoint = parsed.endpoint;
        this.accessKey = parsed.accessKey;
        console.log('Azure SignalR Service initialized with hub:', this.hubName);
        console.log('Endpoint:', this.endpoint);
    }
    // CRITICAL: For Azure SignalR Service, use the Base64 string directly as HMAC key
    // NOT the decoded Buffer. This is specific to Azure SignalR's implementation.
    get hmacKey() {
        return this.accessKey; // Use Base64 string directly
    }
    // 🎯 CRITICAL: Get base endpoint URL for REST API calls
    // this.endpoint is like: https://ticketing-system.service.signalr.net/client/?hub=realtimeticket
    // We need: https://ticketing-system.service.signalr.net
    get baseEndpoint() {
        const endpointUrl = new URL(this.endpoint);
        return `${endpointUrl.protocol}//${endpointUrl.host}`;
    }
    parseConnectionString(connectionString) {
        console.log('🔍 [SignalR Config] Parsing connection string...');
        console.log('🔍 [SignalR Config] Connection string length:', (connectionString === null || connectionString === void 0 ? void 0 : connectionString.length) || 0);
        console.log('🔍 [SignalR Config] Connection string preview:', (connectionString === null || connectionString === void 0 ? void 0 : connectionString.substring(0, 50)) + '...');
        const parts = connectionString.split(';');
        console.log('🔍 [SignalR Config] Connection string parts count:', parts.length);
        let endpoint = '';
        let accessKey = '';
        for (const part of parts) {
            console.log('🔍 [SignalR Config] Processing part:', part.substring(0, 20) + '...');
            if (part.startsWith('Endpoint=')) {
                endpoint = part.substring('Endpoint='.length);
                console.log('✅ [SignalR Config] Endpoint found:', endpoint);
            }
            else if (part.startsWith('AccessKey=')) {
                accessKey = part.substring('AccessKey='.length);
                console.log('✅ [SignalR Config] AccessKey found, length:', accessKey.length);
                console.log('✅ [SignalR Config] AccessKey preview:', accessKey.substring(0, 10) + '...');
            }
        }
        if (!endpoint || !accessKey) {
            console.error('❌ [SignalR Config] Missing required parts:');
            console.error('❌ [SignalR Config] Endpoint present:', !!endpoint);
            console.error('❌ [SignalR Config] AccessKey present:', !!accessKey);
            throw new Error('Invalid Azure SignalR connection string format');
        }
        console.log('✅ [SignalR Config] Connection string parsed successfully');
        return { endpoint, accessKey };
    }
    // Generate client token for SignalR connections (negotiate)
    buildClientToken(userId, roles = []) {
        console.log('🔐 [SignalR Config] Generating CLIENT access token for user:', userId);
        console.log('🔐 [SignalR Config] Roles:', roles);
        // 🚨 DEBUG: 验证使用的密钥类型
        console.log('🚨 [DEBUG] Checking signing key type...');
        console.log('🚨 [DEBUG] JWT_SECRET exists:', !!process.env.JWT_SECRET);
        console.log('🚨 [DEBUG] AZURE_SIGNALR_CONNECTION_STRING exists:', !!process.env.AZURE_SIGNALR_CONNECTION_STRING);
        console.log('🚨 [DEBUG] Using hmacKey (Azure SignalR AccessKey):', this.hmacKey.substring(0, 20) + '...');
        console.log('🚨 [DEBUG] NOT using JWT_SECRET for SignalR token generation');
        const now = Math.floor(Date.now() / 1000);
        const exp = now + (60 * 60); // 1 hour
        // CLIENT audience: https://<service>.service.signalr.net/client/?hub=<hubName>
        const audience = `${this.endpoint.replace(/\/+$/, '')}/client/?hub=${this.hubName}`;
        // 🚨 DEBUG: 验证 audience 构建
        console.log('🚨 [DEBUG] Audience details:');
        console.log('🚨 [DEBUG] - Raw endpoint:', this.endpoint);
        console.log('🚨 [DEBUG] - Hub name:', this.hubName);
        console.log('🚨 [DEBUG] - Final audience:', audience);
        const payload = {
            aud: audience,
            iat: now,
            exp: exp,
            nameid: userId,
            // role is optional for client tokens
            ...(roles.length > 0 && { role: roles })
        };
        console.log('🔐 [SignalR Config] CLIENT Token payload:', {
            aud: audience,
            nameid: userId,
            role: roles,
            iat: now,
            exp: exp
        });
        // 🚨 DEBUG: 显示时间信息
        const currentTime = new Date(now * 1000).toISOString();
        const expiryTime = new Date(exp * 1000).toISOString();
        console.log('🚨 [DEBUG] Token timing:');
        console.log('🚨 [DEBUG] - Current time (iat):', currentTime);
        console.log('🚨 [DEBUG] - Expiry time (exp):', expiryTime);
        console.log('🚨 [DEBUG] - Valid for (hours):', (exp - now) / 3600);
        const token = jsonwebtoken_1.default.sign(payload, this.hmacKey, { algorithm: 'HS256' });
        console.log('✅ [SignalR Config] CLIENT Access token generated, length:', token.length);
        console.log('🚨 [DEBUG] Token preview:', token.substring(0, 50) + '...');
        // Verify the token immediately to ensure it's valid
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.hmacKey, { algorithms: ['HS256'] });
            console.log('✅ [SignalR Config] CLIENT Token verification successful');
            console.log('🚨 [DEBUG] Decoded token payload:', decoded);
        }
        catch (verifyError) {
            console.error('❌ [SignalR Config] CLIENT Token verification failed:', verifyError);
        }
        return token;
    }
    // Generate server token for REST API calls with specific resource path
    buildServerToken(resourcePath = '') {
        console.log('🔐 [SignalR Config] Generating SERVER access token for REST API');
        console.log('🔐 [SignalR Config] Resource path:', resourcePath);
        const now = Math.floor(Date.now() / 1000);
        const exp = now + (60 * 10); // 10 minutes (shorter for server tokens)
        // 🎯 CRITICAL FIX: Get base URL from endpoint (remove client path)
        const baseEndpoint = this.baseEndpoint;
        // 🎯 CRITICAL: Use specific resource path for audience
        // For sendToUser: https://<service>.service.signalr.net/api/v1/hubs/<hubName>/users/<userId>
        // For sendToGroup: https://<service>.service.signalr.net/api/v1/hubs/<hubName>/groups/<group>
        // For broadcast: https://<service>.service.signalr.net/api/v1/hubs/<hubName>
        const basePath = `${baseEndpoint}/api/v1/hubs/${this.hubName}`;
        const audience = resourcePath ? `${basePath}${resourcePath}` : basePath;
        console.log('🚨 [DEBUG] Server token audience construction:');
        console.log('🚨 [DEBUG] - Raw endpoint:', this.endpoint);
        console.log('🚨 [DEBUG] - Base endpoint:', baseEndpoint);
        console.log('🚨 [DEBUG] - Hub name:', this.hubName);
        console.log('🚨 [DEBUG] - Resource path:', resourcePath);
        console.log('🚨 [DEBUG] - Final audience:', audience);
        const payload = {
            aud: audience,
            iat: now,
            exp: exp,
            // CRITICAL: Add server role for group management permissions
            role: ['signalr.serviceOwner', 'signalr.hubOwner']
        };
        console.log('🔐 [SignalR Config] SERVER Token payload:', {
            aud: audience,
            iat: now,
            exp: exp,
            role: payload.role
        });
        const token = jsonwebtoken_1.default.sign(payload, this.hmacKey, { algorithm: 'HS256' });
        console.log('✅ [SignalR Config] SERVER Access token generated, length:', token.length);
        // Verify the token immediately to ensure it's valid
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.hmacKey, { algorithms: ['HS256'] });
            console.log('✅ [SignalR Config] SERVER Token verification successful');
        }
        catch (verifyError) {
            console.error('❌ [SignalR Config] SERVER Token verification failed:', verifyError);
        }
        return token;
    }
    // Legacy method for backward compatibility - now uses client token
    generateAccessToken(userId, roles = ['signalr.client']) {
        return this.buildClientToken(userId, roles);
    }
    getConnectionInfo(userId, hub, roles) {
        const hubName = hub || this.hubName;
        console.log('🔗 [SignalR Config] Getting connection info for user:', userId);
        console.log('🔗 [SignalR Config] Hub name:', hubName);
        console.log('🔗 [SignalR Config] Roles:', roles);
        // Use client token for connection info
        const accessToken = this.buildClientToken(userId, roles || []);
        const url = `${this.endpoint}/client/?hub=${hubName}`;
        console.log('✅ [SignalR Config] Connection info generated:');
        console.log('✅ [SignalR Config] URL:', url);
        console.log('✅ [SignalR Config] Access token ready for user:', userId);
        return {
            url,
            accessToken
        };
    }
    async sendToDevice(deviceId, message) {
        await this.sendToUser(deviceId, message);
    }
    async sendToDashboard(message) {
        // Broadcast to all connected users instead of using groups
        try {
            // Use the correct endpoint for broadcasting to all connections
            const url = `${this.baseEndpoint}/api/v1/hubs/${this.hubName}`;
            const token = this.buildServerToken(); // Use server token for REST API (broadcast to all)
            // Format message for Azure SignalR Service REST API
            // The correct format for sending to all clients
            const signalRMessage = {
                target: "message", // The method name on the client
                arguments: [message] // Array of arguments to pass to the client method
            };
            console.log('📤 [SignalR Config] Sending dashboard message:', JSON.stringify(signalRMessage, null, 2));
            console.log('📤 [SignalR Config] Using URL:', url);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(signalRMessage)
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ [SignalR Config] Dashboard broadcast failed:', response.status, errorText);
                console.error('❌ [SignalR Config] Request URL:', url);
                console.error('❌ [SignalR Config] Request payload:', JSON.stringify(signalRMessage, null, 2));
                console.error('❌ [SignalR Config] Response headers:', Object.fromEntries(response.headers.entries()));
                throw new Error(`Failed to broadcast message to all users: ${response.statusText} - ${errorText}`);
            }
            console.log(`✅ [SignalR Config] Message broadcasted to all users:`, message.type);
        }
        catch (error) {
            console.error(`❌ [SignalR Config] Failed to broadcast message to all users:`, error);
            throw error;
        }
    }
    async sendToGroup(group, message) {
        try {
            const url = `${this.baseEndpoint}/api/v1/hubs/${this.hubName}/groups/${group}`;
            const token = this.buildServerToken(`/groups/${group}`); // Use server token for REST API (send to group)
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message)
            });
            if (!response.ok) {
                throw new Error(`Failed to send message to group ${group}: ${response.statusText}`);
            }
            console.log(`Message sent to group ${group}:`, message.type);
        }
        catch (error) {
            console.error(`Failed to send message to group ${group}:`, error);
            throw error;
        }
    }
    async sendToUser(userId, message) {
        try {
            const url = `${this.baseEndpoint}/api/v1/hubs/${this.hubName}/users/${userId}`;
            const token = this.buildServerToken(`/users/${userId}`); // Use server token for REST API (send to user)
            // 🎯 CRITICAL FIX: Format message properly for Azure SignalR Service
            // Convert from {type: "SHOW_FEEDBACK", payload: {...}} to Azure SignalR format
            let signalRMessage;
            if (message.type) {
                // Map our internal message types to SignalR method names that iPad expects
                const methodNameMap = {
                    'SHOW_FEEDBACK': 'showFeedback',
                    'DISMISS': 'dismiss',
                    'PING': 'ping',
                    'LOCK_ASSIGNED': 'lockAssigned',
                    'MODE_CHANGED': 'modeChanged',
                    'UNPAIRED': 'unpaired'
                };
                const methodName = methodNameMap[message.type] || message.type.toLowerCase();
                // Format for Azure SignalR Service REST API
                signalRMessage = {
                    target: methodName, // The method name the iPad client expects
                    arguments: message.payload ? [message.payload] : [] // Arguments array
                };
                // 🚨 CRITICAL DEBUG: Special logging for UNPAIRED messages
                if (message.type === 'UNPAIRED') {
                    console.log(`🚨 [UNPAIR DEBUG] Sending UNPAIRED message to device ${userId}:`);
                    console.log(`🚨 [UNPAIR DEBUG] - Original message:`, JSON.stringify(message, null, 2));
                    console.log(`🚨 [UNPAIR DEBUG] - Mapped method name: ${methodName}`);
                    console.log(`🚨 [UNPAIR DEBUG] - Final SignalR message:`, JSON.stringify(signalRMessage, null, 2));
                    console.log(`🚨 [UNPAIR DEBUG] - Target URL: ${url}`);
                }
                console.log(`📤 [SignalR Config] Sending to device ${userId}:`, {
                    originalType: message.type,
                    signalRMethod: methodName,
                    hasPayload: !!message.payload
                });
            }
            else {
                // Fallback for raw SignalR messages
                signalRMessage = message;
            }
            console.log(`📤 [SignalR Config] Final SignalR message for ${userId}:`, JSON.stringify(signalRMessage, null, 2));
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(signalRMessage)
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ [SignalR Config] Failed to send message to user ${userId}:`, response.status, errorText);
                console.error(`❌ [SignalR Config] Request URL:`, url);
                console.error(`❌ [SignalR Config] Request payload:`, JSON.stringify(signalRMessage, null, 2));
                console.error(`❌ [SignalR Config] Response headers:`, Object.fromEntries(response.headers.entries()));
                throw new Error(`Failed to send message to user ${userId}: ${response.statusText} - ${errorText}`);
            }
            console.log(`✅ [SignalR Config] Message sent to user ${userId}:`, message.type || 'custom');
        }
        catch (error) {
            console.error(`❌ [SignalR Config] Failed to send message to user ${userId}:`, error);
            throw error;
        }
    }
    async addUserToGroup(userId, group) {
        try {
            const url = `${this.baseEndpoint}/api/v1/hubs/${this.hubName}/groups/${group}/users/${userId}`;
            const token = this.buildServerToken(`/groups/${group}/users/${userId}`); // Use server token for REST API (add user to group)
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to add user ${userId} to group ${group}: ${response.statusText}`);
            }
            console.log(`User ${userId} added to group ${group}`);
        }
        catch (error) {
            console.error(`Failed to add user ${userId} to group ${group}:`, error);
            throw error;
        }
    }
    async removeUserFromGroup(userId, group) {
        try {
            const url = `${this.baseEndpoint}/api/v1/hubs/${this.hubName}/groups/${group}/users/${userId}`;
            const token = this.buildServerToken(`/groups/${group}/users/${userId}`); // Use server token for REST API (remove user from group)
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to remove user ${userId} from group ${group}: ${response.statusText}`);
            }
            console.log(`User ${userId} removed from group ${group}`);
        }
        catch (error) {
            console.error(`Failed to remove user ${userId} from group ${group}:`, error);
            throw error;
        }
    }
}
exports.AzureSignalRServiceConfig = AzureSignalRServiceConfig;
// Export singleton instance
exports.signalRConfig = new AzureSignalRServiceConfig();
// Environment validation
function validateSignalREnvironment() {
    const required = [
        'AZURE_SIGNALR_CONNECTION_STRING'
    ];
    const missing = required.filter(env => !process.env[env]);
    if (missing.length > 0) {
        console.error('Missing required SignalR environment variables:', missing.join(', '));
        return false;
    }
    return true;
}
// Helper function for generating connection info with custom options
function generateDeviceConnectionInfo(deviceId) {
    console.log('🔧 [Helper] Generating device connection info for:', deviceId);
    // Use default roles for client connections
    const connectionInfo = exports.signalRConfig.getConnectionInfo(deviceId);
    console.log('✅ [Helper] Device connection info generated');
    return connectionInfo;
}
function generateDashboardConnectionInfo(userId) {
    console.log('🔧 [Helper] Generating dashboard connection info for:', userId);
    // Use default roles for client connections  
    const connectionInfo = exports.signalRConfig.getConnectionInfo(userId);
    console.log('✅ [Helper] Dashboard connection info generated');
    return connectionInfo;
}
//# sourceMappingURL=config.js.map