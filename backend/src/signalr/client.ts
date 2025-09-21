import { signalRConfig } from './config';
import { 
  ServerToDevice, 
  DeviceToServer,
  DeviceMode,
  FeedbackShowPayload,
  SignalRMessage
} from './types';

export class SignalRClient {
  
  constructor() {
    // No initialization needed for serverless SignalR
  }

  // Message Sending Methods - Serverless compatible
  public async sendToDevice(deviceId: string, message: ServerToDevice): Promise<boolean> {
    try {
      await signalRConfig.sendToUser(deviceId, message);
      console.log(`Message sent to device ${deviceId}:`, message.type);
      return true;
    } catch (error) {
      console.error(`Failed to send message to device ${deviceId}:`, error);
      return false;
    }
  }

  public async sendToDashboard(message: any): Promise<void> {
    try {
      await signalRConfig.sendToDashboard(message);
      console.log(`Message sent to dashboard:`, message.type);
    } catch (error) {
      console.error(`Failed to send message to dashboard:`, error);
    }
  }

  public async broadcastToDevices(message: ServerToDevice, mode?: DeviceMode): Promise<void> {
    try {
      // In serverless mode with userId-based messaging, we need to send to each device individually
      // TODO: Implement device list retrieval from database to get active device IDs
      // For now, log the broadcast attempt - this method would need a list of device IDs
      console.log(`Broadcast request for message ${message.type} to devices with mode: ${mode || 'all'}`);
      console.log(`Note: In serverless mode, broadcast requires individual device IDs. Use sendToDevice for specific devices.`);
    } catch (error) {
      console.error(`Failed to broadcast message to devices:`, error);
    }
  }

  // Specific message methods matching websocket interface
  public async showFeedback(deviceId: string, payload: FeedbackShowPayload): Promise<boolean> {
    return this.sendToDevice(deviceId, { type: "SHOW_FEEDBACK", payload });
  }

  public async dismissDevice(deviceId: string): Promise<boolean> {
    return this.sendToDevice(deviceId, { type: "DISMISS" });
  }

  public async pingDevice(deviceId: string, payload?: { now: string }): Promise<boolean> {
    const message: ServerToDevice = { type: "PING" };
    if (payload) {
      message.payload = payload;
    }
    return this.sendToDevice(deviceId, message);
  }

  public async lockAssigned(deviceId: string, payload: any): Promise<boolean> {
    return this.sendToDevice(deviceId, { type: "LOCK_ASSIGNED", payload });
  }

  public async modeChanged(deviceId: string, mode: DeviceMode): Promise<boolean> {
    return this.sendToDevice(deviceId, { type: 'MODE_CHANGED', payload: { mode } });
  }

  public async unpaired(deviceId: string): Promise<boolean> {
    return this.sendToDevice(deviceId, { type: 'UNPAIRED' });
  }

  // Dashboard notification methods
  public async notifyDashboard(message: any): Promise<void>;
  public async notifyDashboard(type: string, payload: any): Promise<void>;
  public async notifyDashboard(typeOrMessage: string | any, payload?: any): Promise<void> {
    if (typeof typeOrMessage === 'string') {
      await this.sendToDashboard({ type: typeOrMessage, payload });
    } else {
      await this.sendToDashboard(typeOrMessage);
    }
  }

  public async caseUpdated(caseData: { id: string; status: string }): Promise<void> {
    await this.sendToDashboard({ type: 'caseUpdated', payload: caseData });
  }

  public async deviceUpdated(deviceData: { id: string; isBusy: boolean; isOnline: boolean }): Promise<void> {
    await this.sendToDashboard({ type: 'deviceUpdated', payload: deviceData });
  }

  public async deviceConnected(deviceId: string, mode: DeviceMode): Promise<void> {
    await this.sendToDashboard({ 
      type: 'deviceConnected', 
      payload: { deviceId, mode } 
    });
  }

  public async deviceDisconnected(deviceId: string): Promise<void> {
    await this.sendToDashboard({ 
      type: 'deviceDisconnected', 
      payload: { deviceId } 
    });
  }

  // Connection management (simplified for serverless)
  public async isDeviceConnected(deviceId: string): Promise<boolean> {
    try {
      // In serverless mode, we can't easily check connection status
      // This would need to be implemented using a separate tracking mechanism
      console.log(`Checking if device ${deviceId} is connected`);
      return false; // Default to false for serverless mode
    } catch (error) {
      console.error(`Failed to check device status for ${deviceId}:`, error);
      return false;
    }
  }

  public async isDeviceOnline(deviceId: string): Promise<boolean> {
    return this.isDeviceConnected(deviceId);
  }

  // Device action methods
  public async assignLockToDevice(deviceId: string, payload: any): Promise<boolean> {
    return this.lockAssigned(deviceId, payload);
  }

  public async changeModeDevice(deviceId: string, mode: DeviceMode): Promise<boolean> {
    return this.modeChanged(deviceId, mode);
  }

  public async unpairDevice(deviceId: string): Promise<boolean> {
    return this.unpaired(deviceId);
  }

  public async pingAllDevices(): Promise<void> {
    try {
      // In serverless mode with userId-based messaging, we need device IDs to ping individually
      // TODO: Implement device list retrieval from database to get active device IDs
      console.log('Ping all devices requested - requires individual device IDs in serverless mode');
    } catch (error) {
      console.error('Failed to ping all devices:', error);
    }
  }

  // Group management (simplified for serverless userId mode)
  public async addDeviceToGroups(connectionId: string, deviceId: string, mode: DeviceMode): Promise<void> {
    // In serverless userId mode, no group management needed
    // Devices are identified by their userId (deviceId) directly
    console.log(`Device ${deviceId} connected with mode ${mode} - no group management needed in userId mode`);
  }

  public async removeDeviceFromGroups(connectionId: string, deviceId: string, mode: DeviceMode): Promise<void> {
    // In serverless userId mode, no group management needed
    console.log(`Device ${deviceId} disconnected - no group management needed in userId mode`);
  }

  public async addDashboardToGroup(connectionId: string): Promise<void> {
    // In serverless userId mode, no group management needed
    console.log(`Dashboard connection added - no group management needed in userId mode`);
  }

  public async removeDashboardFromGroup(connectionId: string): Promise<void> {
    // In serverless userId mode, no group management needed
    console.log(`Dashboard connection removed - no group management needed in userId mode`);
  }

  public async addDashboardUserToGroup(connectionId: string, userId: string): Promise<void> {
    // In serverless userId mode, no group management needed
    console.log(`Dashboard user ${userId} connected - no group management needed in userId mode`);
  }

  public async removeDashboardUserFromGroup(connectionId: string, userId: string): Promise<void> {
    // In serverless userId mode, no group management needed
    console.log(`Dashboard user ${userId} disconnected - no group management needed in userId mode`);
  }

  // Utility methods
  public getConnectionStats(): Promise<{ total: number; serverless: boolean }> {
    return Promise.resolve({
      total: 0, // Can't get real connection count in serverless mode
      serverless: true
    });
  }
}

// Export singleton instance
export const signalRClient = new SignalRClient();
