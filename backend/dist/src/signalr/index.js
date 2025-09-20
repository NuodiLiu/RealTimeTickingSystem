"use strict";
// SignalR Infrastructure Entry Point
// This module provides a SignalR-based replacement for the websocket system
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalRGateway = exports.signalRRoutes = exports.getDashboardConnectionUrl = exports.getDeviceConnectionUrl = exports.signalRAuthMiddleware = exports.verifySignalRToken = exports.generateDashboardToken = exports.generateSignalRToken = exports.signalREventHandler = exports.signalRConfig = exports.signalRClient = void 0;
var client_1 = require("./client");
Object.defineProperty(exports, "signalRClient", { enumerable: true, get: function () { return client_1.signalRClient; } });
var config_1 = require("./config");
Object.defineProperty(exports, "signalRConfig", { enumerable: true, get: function () { return config_1.signalRConfig; } });
var eventHandler_1 = require("./eventHandler");
Object.defineProperty(exports, "signalREventHandler", { enumerable: true, get: function () { return eventHandler_1.signalREventHandler; } });
var auth_1 = require("./auth");
Object.defineProperty(exports, "generateSignalRToken", { enumerable: true, get: function () { return auth_1.generateSignalRToken; } });
Object.defineProperty(exports, "generateDashboardToken", { enumerable: true, get: function () { return auth_1.generateDashboardToken; } });
Object.defineProperty(exports, "verifySignalRToken", { enumerable: true, get: function () { return auth_1.verifySignalRToken; } });
Object.defineProperty(exports, "signalRAuthMiddleware", { enumerable: true, get: function () { return auth_1.signalRAuthMiddleware; } });
Object.defineProperty(exports, "getDeviceConnectionUrl", { enumerable: true, get: function () { return auth_1.getDeviceConnectionUrl; } });
Object.defineProperty(exports, "getDashboardConnectionUrl", { enumerable: true, get: function () { return auth_1.getDashboardConnectionUrl; } });
var routes_1 = require("./routes");
Object.defineProperty(exports, "signalRRoutes", { enumerable: true, get: function () { return __importDefault(routes_1).default; } });
__exportStar(require("./types"), exports);
// Main SignalR service class that provides the same interface as websocket system
const client_2 = require("./client");
const eventHandler_2 = require("./eventHandler");
/**
 * SignalR Gateway - Provides the same interface as the websocket DeviceGateway
 * This class can be used as a drop-in replacement for the websocket system
 * Optimized for serverless environments
 */
class SignalRGateway {
    // Device Management Methods - Serverless compatible
    static async isDeviceOnline(deviceId) {
        return await client_2.signalRClient.isDeviceConnected(deviceId);
    }
    static async getConnectionStats() {
        return await client_2.signalRClient.getConnectionStats();
    }
    // Message Sending Methods (matching websocket interface)
    static async sendToDevice(deviceId, message) {
        return await client_2.signalRClient.sendToDevice(deviceId, message);
    }
    static async showFeedback(deviceId, payload) {
        return await client_2.signalRClient.showFeedback(deviceId, payload);
    }
    static async dismissDevice(deviceId) {
        return await client_2.signalRClient.dismissDevice(deviceId);
    }
    static async pingDevice(deviceId, payload) {
        return await client_2.signalRClient.pingDevice(deviceId, payload);
    }
    static async assignLockToDevice(deviceId, payload) {
        return await client_2.signalRClient.assignLockToDevice(deviceId, payload);
    }
    static async changeModeDevice(deviceId, mode) {
        return await client_2.signalRClient.changeModeDevice(deviceId, mode);
    }
    static async unpairDevice(deviceId) {
        return await client_2.signalRClient.unpairDevice(deviceId);
    }
    static async broadcastToDevices(message, mode) {
        return await client_2.signalRClient.broadcastToDevices(message, mode);
    }
    // Dashboard notification methods
    static async notifyDashboard(message) {
        return await client_2.signalRClient.notifyDashboard(message);
    }
    // Health and maintenance - Serverless compatible
    static async pingAllDevices() {
        return await client_2.signalRClient.pingAllDevices();
    }
    // Event handlers (these would be called by Azure Web PubSub webhooks)
    static async handleDeviceConnect(deviceId, connectionId, mode) {
        return await eventHandler_2.signalREventHandler.handleDeviceConnect(deviceId, connectionId, mode);
    }
    static async handleDeviceDisconnect(deviceId, connectionId) {
        return await eventHandler_2.signalREventHandler.handleDeviceDisconnect(deviceId, connectionId);
    }
    static async handleDeviceMessage(deviceId, message) {
        return await eventHandler_2.signalREventHandler.handleDeviceMessage(deviceId, message);
    }
    static async handleDashboardConnect(connectionId, userId) {
        return await eventHandler_2.signalREventHandler.handleDashboardConnect(connectionId, userId);
    }
    static async handleDashboardDisconnect(connectionId) {
        return await eventHandler_2.signalREventHandler.handleDashboardDisconnect(connectionId);
    }
}
exports.SignalRGateway = SignalRGateway;
// Default export for easy importing
exports.default = SignalRGateway;
//# sourceMappingURL=index.js.map