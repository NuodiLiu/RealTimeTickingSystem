"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signalRClient = exports.SignalRClient = void 0;
const config_1 = require("./config");
class SignalRClient {
    constructor() {
        // No initialization needed for serverless SignalR
    }
    // Message Sending Methods - Serverless compatible
    async sendToDevice(deviceId, message) {
        try {
            await config_1.signalRConfig.sendToUser(deviceId, message);
            console.log(`Message sent to device ${deviceId}:`, message.type);
            return true;
        }
        catch (error) {
            console.error(`Failed to send message to device ${deviceId}:`, error);
            return false;
        }
    }
    async sendToDashboard(message) {
        try {
            await config_1.signalRConfig.sendToDashboard(message);
            console.log(`Message sent to dashboard:`, message.type);
        }
        catch (error) {
            console.error(`Failed to send message to dashboard:`, error);
        }
    }
    async broadcastToDevices(message, mode) {
        try {
            // Broadcast to all connected users instead of specific device groups
            await config_1.signalRConfig.sendToDashboard(message);
            console.log(`Message broadcasted to all users:`, message.type);
        }
        catch (error) {
            console.error(`Failed to broadcast message to all users:`, error);
        }
    }
    // Specific message methods matching websocket interface
    async showFeedback(deviceId, payload) {
        return this.sendToDevice(deviceId, { type: "SHOW_FEEDBACK", payload });
    }
    async dismissDevice(deviceId) {
        return this.sendToDevice(deviceId, { type: "DISMISS" });
    }
    async pingDevice(deviceId, payload) {
        const message = { type: "PING" };
        if (payload) {
            message.payload = payload;
        }
        return this.sendToDevice(deviceId, message);
    }
    async lockAssigned(deviceId, payload) {
        return this.sendToDevice(deviceId, { type: "LOCK_ASSIGNED", payload });
    }
    async modeChanged(deviceId, mode) {
        return this.sendToDevice(deviceId, { type: 'MODE_CHANGED', payload: { mode } });
    }
    async unpaired(deviceId) {
        return this.sendToDevice(deviceId, { type: 'UNPAIRED' });
    }
    async notifyDashboard(typeOrMessage, payload) {
        if (typeof typeOrMessage === 'string') {
            await this.sendToDashboard({ type: typeOrMessage, payload });
        }
        else {
            await this.sendToDashboard(typeOrMessage);
        }
    }
    async caseUpdated(caseData) {
        await this.sendToDashboard({ type: 'caseUpdated', payload: caseData });
    }
    async deviceUpdated(deviceData) {
        await this.sendToDashboard({ type: 'deviceUpdated', payload: deviceData });
    }
    async deviceConnected(deviceId, mode) {
        await this.sendToDashboard({
            type: 'deviceConnected',
            payload: { deviceId, mode }
        });
    }
    async deviceDisconnected(deviceId) {
        await this.sendToDashboard({
            type: 'deviceDisconnected',
            payload: { deviceId }
        });
    }
    // Connection management (simplified for serverless)
    async isDeviceConnected(deviceId) {
        try {
            // In serverless mode, we can't easily check connection status
            // This would need to be implemented using a separate tracking mechanism
            console.log(`Checking if device ${deviceId} is connected`);
            return false; // Default to false for serverless mode
        }
        catch (error) {
            console.error(`Failed to check device status for ${deviceId}:`, error);
            return false;
        }
    }
    async isDeviceOnline(deviceId) {
        return this.isDeviceConnected(deviceId);
    }
    // Device action methods
    async assignLockToDevice(deviceId, payload) {
        return this.lockAssigned(deviceId, payload);
    }
    async changeModeDevice(deviceId, mode) {
        return this.modeChanged(deviceId, mode);
    }
    async unpairDevice(deviceId) {
        return this.unpaired(deviceId);
    }
    async pingAllDevices() {
        try {
            // Broadcast ping to all connected users
            await config_1.signalRConfig.sendToDashboard({ type: "PING", payload: { now: new Date().toISOString() } });
            console.log('Ping broadcasted to all connected users');
        }
        catch (error) {
            console.error('Failed to ping all users:', error);
        }
    }
    // Group management (simplified for serverless)
    async addDeviceToGroups(connectionId, deviceId, mode) {
        try {
            // In serverless mode, group management is handled by Azure SignalR Service
            // Groups are assigned during connection negotiation
            await config_1.signalRConfig.addUserToGroup(deviceId, 'devices');
            await config_1.signalRConfig.addUserToGroup(deviceId, `device-${deviceId}`);
            await config_1.signalRConfig.addUserToGroup(deviceId, `mode-${mode.toLowerCase()}`);
            console.log(`Device ${deviceId} added to groups for mode ${mode}`);
        }
        catch (error) {
            console.error(`Failed to add device ${deviceId} to groups:`, error);
        }
    }
    async removeDeviceFromGroups(connectionId, deviceId, mode) {
        try {
            await config_1.signalRConfig.removeUserFromGroup(deviceId, 'devices');
            await config_1.signalRConfig.removeUserFromGroup(deviceId, `device-${deviceId}`);
            await config_1.signalRConfig.removeUserFromGroup(deviceId, `mode-${mode.toLowerCase()}`);
            console.log(`Device ${deviceId} removed from groups`);
        }
        catch (error) {
            console.error(`Failed to remove device ${deviceId} from groups:`, error);
        }
    }
    async addDashboardToGroup(connectionId) {
        try {
            // In serverless mode, we use userId instead of connectionId
            await config_1.signalRConfig.addUserToGroup(connectionId, 'dashboard');
            console.log(`Dashboard connection ${connectionId} added to group`);
        }
        catch (error) {
            console.error(`Failed to add dashboard connection ${connectionId} to group:`, error);
        }
    }
    async removeDashboardFromGroup(connectionId) {
        try {
            await config_1.signalRConfig.removeUserFromGroup(connectionId, 'dashboard');
            console.log(`Dashboard connection ${connectionId} removed from group`);
        }
        catch (error) {
            console.error(`Failed to remove dashboard connection ${connectionId} from group:`, error);
        }
    }
    async addDashboardUserToGroup(connectionId, userId) {
        try {
            await config_1.signalRConfig.addUserToGroup(userId, 'dashboard');
            console.log(`Dashboard user ${userId} added to group`);
        }
        catch (error) {
            console.error(`Failed to add dashboard user ${userId} to group:`, error);
        }
    }
    async removeDashboardUserFromGroup(connectionId, userId) {
        try {
            await config_1.signalRConfig.removeUserFromGroup(userId, 'dashboard');
            console.log(`Dashboard user ${userId} removed from group`);
        }
        catch (error) {
            console.error(`Failed to remove dashboard user ${userId} from group:`, error);
        }
    }
    // Utility methods
    getConnectionStats() {
        return Promise.resolve({
            total: 0, // Can't get real connection count in serverless mode
            serverless: true
        });
    }
}
exports.SignalRClient = SignalRClient;
// Export singleton instance
exports.signalRClient = new SignalRClient();
//# sourceMappingURL=client.js.map