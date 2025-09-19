// SignalR Infrastructure Entry Point
// This module provides a SignalR-based replacement for the websocket system

export { signalRClient } from './client';
export { signalRConfig } from './config';
export { signalREventHandler } from './eventHandler';
export { 
  generateSignalRToken, 
  generateDashboardToken, 
  verifySignalRToken,
  signalRAuthMiddleware,
  getDeviceConnectionUrl,
  getDashboardConnectionUrl,
  type SignalRAuthRequest
} from './auth';
export { default as signalRRoutes } from './routes';
export * from './types';

// Main SignalR service class that provides the same interface as websocket system
import { signalRClient } from './client';
import { signalREventHandler } from './eventHandler';
import { 
  ServerToDevice, 
  DeviceMode, 
  FeedbackShowPayload,
  DeviceConnectionInfo 
} from './types';

/**
 * SignalR Gateway - Provides the same interface as the websocket DeviceGateway
 * This class can be used as a drop-in replacement for the websocket system
 * Optimized for serverless environments
 */
export class SignalRGateway {
  
  // Device Management Methods - Serverless compatible
  static async isDeviceOnline(deviceId: string): Promise<boolean> {
    return await signalRClient.isDeviceConnected(deviceId);
  }
  
  static async getConnectionStats() {
    return await signalRClient.getConnectionStats();
  }
  
  // Message Sending Methods (matching websocket interface)
  static async sendToDevice(deviceId: string, message: ServerToDevice): Promise<boolean> {
    return await signalRClient.sendToDevice(deviceId, message);
  }
  
  static async showFeedback(deviceId: string, payload: FeedbackShowPayload): Promise<boolean> {
    return await signalRClient.showFeedback(deviceId, payload);
  }
  
  static async dismissDevice(deviceId: string): Promise<boolean> {
    return await signalRClient.dismissDevice(deviceId);
  }
  
  static async pingDevice(deviceId: string, payload?: { now: string }): Promise<boolean> {
    return await signalRClient.pingDevice(deviceId, payload);
  }
  
  static async assignLockToDevice(deviceId: string, payload: any): Promise<boolean> {
    return await signalRClient.assignLockToDevice(deviceId, payload);
  }
  
  static async changeModeDevice(deviceId: string, mode: DeviceMode): Promise<boolean> {
    return await signalRClient.changeModeDevice(deviceId, mode);
  }
  
  static async unpairDevice(deviceId: string): Promise<boolean> {
    return await signalRClient.unpairDevice(deviceId);
  }
  
  static async broadcastToDevices(message: ServerToDevice, mode?: DeviceMode): Promise<void> {
    return await signalRClient.broadcastToDevices(message, mode);
  }
  
  // Dashboard notification methods
  static async notifyDashboard(message: { type: string; payload: any }): Promise<void> {
    return await signalRClient.notifyDashboard(message);
  }
  
  // Health and maintenance - Serverless compatible
  static async pingAllDevices(): Promise<void> {
    return await signalRClient.pingAllDevices();
  }
  
  // Event handlers (these would be called by Azure Web PubSub webhooks)
  static async handleDeviceConnect(deviceId: string, connectionId: string, mode: DeviceMode): Promise<void> {
    return await signalREventHandler.handleDeviceConnect(deviceId, connectionId, mode);
  }
  
  static async handleDeviceDisconnect(deviceId: string, connectionId: string): Promise<void> {
    return await signalREventHandler.handleDeviceDisconnect(deviceId, connectionId);
  }
  
  static async handleDeviceMessage(deviceId: string, message: any): Promise<void> {
    return await signalREventHandler.handleDeviceMessage(deviceId, message);
  }
  
  static async handleDashboardConnect(connectionId: string, userId?: string): Promise<void> {
    return await signalREventHandler.handleDashboardConnect(connectionId, userId);
  }
  
  static async handleDashboardDisconnect(connectionId: string): Promise<void> {
    return await signalREventHandler.handleDashboardDisconnect(connectionId);
  }
}

// Default export for easy importing
export default SignalRGateway;
