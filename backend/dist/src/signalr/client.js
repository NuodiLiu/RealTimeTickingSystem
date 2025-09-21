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
            // In serverless mode with userId-based messaging, we need to send to each device individually
            // TODO: Implement device list retrieval from database to get active device IDs
            // For now, log the broadcast attempt - this method would need a list of device IDs
            console.log(`Broadcast request for message ${message.type} to devices with mode: ${mode || 'all'}`);
            console.log(`Note: In serverless mode, broadcast requires individual device IDs. Use sendToDevice for specific devices.`);
        }
        catch (error) {
            console.error(`Failed to broadcast message to devices:`, error);
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
            // In serverless mode with userId-based messaging, we need device IDs to ping individually
            // TODO: Implement device list retrieval from database to get active device IDs
            console.log('Ping all devices requested - requires individual device IDs in serverless mode');
        }
        catch (error) {
            console.error('Failed to ping all devices:', error);
        }
    }
    // Group management (simplified for serverless userId mode)
    async addDeviceToGroups(connectionId, deviceId, mode) {
        // In serverless userId mode, no group management needed
        // Devices are identified by their userId (deviceId) directly
        console.log(`Device ${deviceId} connected with mode ${mode} - no group management needed in userId mode`);
    }
    async removeDeviceFromGroups(connectionId, deviceId, mode) {
        // In serverless userId mode, no group management needed
        console.log(`Device ${deviceId} disconnected - no group management needed in userId mode`);
    }
    async addDashboardToGroup(connectionId) {
        // In serverless userId mode, no group management needed
        console.log(`Dashboard connection added - no group management needed in userId mode`);
    }
    async removeDashboardFromGroup(connectionId) {
        // In serverless userId mode, no group management needed
        console.log(`Dashboard connection removed - no group management needed in userId mode`);
    }
    async addDashboardUserToGroup(connectionId, userId) {
        // In serverless userId mode, no group management needed
        console.log(`Dashboard user ${userId} connected - no group management needed in userId mode`);
    }
    async removeDashboardUserFromGroup(connectionId, userId) {
        // In serverless userId mode, no group management needed
        console.log(`Dashboard user ${userId} disconnected - no group management needed in userId mode`);
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