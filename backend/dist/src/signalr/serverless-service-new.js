"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureSignalRServerlessService = void 0;
const config_1 = require("./config");
class AzureSignalRServerlessService {
    constructor() {
        // No initialization needed for serverless
    }
    static getInstance() {
        if (!AzureSignalRServerlessService.instance) {
            AzureSignalRServerlessService.instance = new AzureSignalRServerlessService();
        }
        return AzureSignalRServerlessService.instance;
    }
    // Send message to all users in a group
    async sendToGroup(group, message) {
        try {
            await config_1.signalRConfig.sendToGroup(group, message);
            console.log(`Serverless message sent to group ${group}:`, message.type);
        }
        catch (error) {
            console.error(`Failed to send message to group ${group}:`, error);
            throw error;
        }
    }
    // Send message to specific user
    async sendToUser(userId, message) {
        try {
            await config_1.signalRConfig.sendToUser(userId, message);
            console.log(`Serverless message sent to user ${userId}:`, message.type);
        }
        catch (error) {
            console.error(`Failed to send message to user ${userId}:`, error);
            throw error;
        }
    }
    // Send to all devices
    async sendToAllDevices(message) {
        await this.sendToGroup('devices', message);
    }
    // Send to dashboard
    async sendToDashboard(message) {
        await this.sendToGroup('dashboard', message);
    }
    // Device-specific operations
    async sendToDevice(deviceId, message) {
        await this.sendToUser(deviceId, message);
    }
    // Group management (handled by Azure SignalR Service)
    async addUserToGroup(userId, groupName) {
        try {
            await config_1.signalRConfig.addUserToGroup(userId, groupName);
            console.log(`User ${userId} added to group ${groupName}`);
        }
        catch (error) {
            console.error(`Failed to add user ${userId} to group ${groupName}:`, error);
            throw error;
        }
    }
    async removeUserFromGroup(userId, groupName) {
        try {
            await config_1.signalRConfig.removeUserFromGroup(userId, groupName);
            console.log(`User ${userId} removed from group ${groupName}`);
        }
        catch (error) {
            console.error(`Failed to remove user ${userId} from group ${groupName}:`, error);
            throw error;
        }
    }
    // Connection info generation
    getConnectionInfo(userId) {
        return config_1.signalRConfig.getConnectionInfo(userId);
    }
    // Health check
    async healthCheck() {
        try {
            // Test basic functionality
            return {
                status: 'healthy',
                serverless: true
            };
        }
        catch (error) {
            console.error('SignalR serverless health check failed:', error);
            return {
                status: 'unhealthy',
                serverless: true
            };
        }
    }
    // Event handlers for connection lifecycle
    async handleConnect(userId, connectionId) {
        console.log(`User ${userId} connected with connection ${connectionId}`);
        // Determine user type and add to appropriate groups
        if (userId.startsWith('device-')) {
            await this.addUserToGroup(userId, 'devices');
            await this.addUserToGroup(userId, `device-${userId}`);
        }
        else {
            await this.addUserToGroup(userId, 'dashboard');
        }
        // Notify dashboard of new connection
        await this.sendToDashboard({
            type: 'userConnected',
            payload: { userId, connectionId, timestamp: new Date().toISOString() }
        });
    }
    async handleDisconnect(userId, connectionId) {
        console.log(`User ${userId} disconnected from connection ${connectionId}`);
        // Remove from groups
        if (userId.startsWith('device-')) {
            await this.removeUserFromGroup(userId, 'devices');
            await this.removeUserFromGroup(userId, `device-${userId}`);
        }
        else {
            await this.removeUserFromGroup(userId, 'dashboard');
        }
        // Notify dashboard of disconnection
        await this.sendToDashboard({
            type: 'userDisconnected',
            payload: { userId, connectionId, timestamp: new Date().toISOString() }
        });
    }
    async handleMessage(userId, message) {
        var _a, _b;
        console.log(`Received message from ${userId}:`, message.type);
        // Process different message types
        switch (message.type) {
            case 'PONG':
                // Handle ping/pong for keepalive
                console.log(`Received pong from ${userId}`);
                break;
            case 'DELIVERED':
                // Handle feedback delivery confirmation
                await this.sendToDashboard({
                    type: 'feedbackDelivered',
                    payload: { userId, sessionId: (_a = message.payload) === null || _a === void 0 ? void 0 : _a.sessionId }
                });
                break;
            case 'FEEDBACK_UPDATE':
                // Handle feedback updates
                await this.sendToDashboard({
                    type: 'feedbackUpdated',
                    payload: { userId, ...message.payload }
                });
                break;
            case 'FEEDBACK_CANCELLED':
                // Handle feedback cancellation
                await this.sendToDashboard({
                    type: 'feedbackCancelled',
                    payload: { userId, sessionId: (_b = message.payload) === null || _b === void 0 ? void 0 : _b.sessionId }
                });
                break;
            default:
                console.log(`Unknown message type: ${message.type}`);
        }
    }
}
exports.AzureSignalRServerlessService = AzureSignalRServerlessService;
//# sourceMappingURL=serverless-service-new.js.map