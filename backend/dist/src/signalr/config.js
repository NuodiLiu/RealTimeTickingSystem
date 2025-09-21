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
        const now = Math.floor(Date.now() / 1000);
        const exp = now + (60 * 60); // 1 hour
        // CLIENT audience: https://<service>.service.signalr.net/client/?hub=<hubName>
        const audience = `${this.endpoint.replace(/\/+$/, '')}/client/?hub=${this.hubName}`;
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
        const token = jsonwebtoken_1.default.sign(payload, this.hmacKey, { algorithm: 'HS256' });
        console.log('✅ [SignalR Config] CLIENT Access token generated, length:', token.length);
        // Verify the token immediately to ensure it's valid
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.hmacKey, { algorithms: ['HS256'] });
            console.log('✅ [SignalR Config] CLIENT Token verification successful');
        }
        catch (verifyError) {
            console.error('❌ [SignalR Config] CLIENT Token verification failed:', verifyError);
        }
        return token;
    }
    // Generate server token for REST API calls (sendToUser, sendToGroup, etc.)
    buildServerToken() {
        console.log('� [SignalR Config] Generating SERVER access token for REST API');
        const now = Math.floor(Date.now() / 1000);
        const exp = now + (60 * 10); // 10 minutes (shorter for server tokens)
        // SERVER audience: https://<service>.service.signalr.net/api/v1/hubs/<hubName>
        const audience = `${this.endpoint.replace(/\/+$/, '')}/api/v1/hubs/${this.hubName}`;
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
            const url = `${this.endpoint}/api/v1/hubs/${this.hubName}`;
            const token = this.buildServerToken(); // Use server token for REST API
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message)
            });
            if (!response.ok) {
                throw new Error(`Failed to broadcast message to all users: ${response.statusText}`);
            }
            console.log(`Message broadcasted to all users:`, message.type);
        }
        catch (error) {
            console.error(`Failed to broadcast message to all users:`, error);
            throw error;
        }
    }
    async sendToGroup(group, message) {
        try {
            const url = `${this.endpoint}/api/v1/hubs/${this.hubName}/groups/${group}`;
            const token = this.buildServerToken(); // Use server token for REST API
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
            const url = `${this.endpoint}/api/v1/hubs/${this.hubName}/users/${userId}`;
            const token = this.buildServerToken(); // Use server token for REST API
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message)
            });
            if (!response.ok) {
                throw new Error(`Failed to send message to user ${userId}: ${response.statusText}`);
            }
            console.log(`Message sent to user ${userId}:`, message.type);
        }
        catch (error) {
            console.error(`Failed to send message to user ${userId}:`, error);
            throw error;
        }
    }
    async addUserToGroup(userId, group) {
        try {
            const url = `${this.endpoint}/api/v1/hubs/${this.hubName}/groups/${group}/users/${userId}`;
            const token = this.buildServerToken(); // Use server token for REST API
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
            const url = `${this.endpoint}/api/v1/hubs/${this.hubName}/groups/${group}/users/${userId}`;
            const token = this.buildServerToken(); // Use server token for REST API
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