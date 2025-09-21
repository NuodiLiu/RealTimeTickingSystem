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
      // Broadcast to all connected users instead of specific device groups
      await signalRConfig.sendToDashboard(message);
      console.log(`Message broadcasted to all users:`, message.type);
    } catch (error) {
      console.error(`Failed to broadcast message to all users:`, error);
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
      // Broadcast ping to all connected users
      await signalRConfig.sendToDashboard({ type: "PING", payload: { now: new Date().toISOString() } });
      console.log('Ping broadcasted to all connected users');
    } catch (error) {
      console.error('Failed to ping all users:', error);
    }
  }

  // Group management (simplified for serverless)
  public async addDeviceToGroups(connectionId: string, deviceId: string, mode: DeviceMode): Promise<void> {
    try {
      // In serverless mode, group management is handled by Azure SignalR Service
      // Groups are assigned during connection negotiation
      await signalRConfig.addUserToGroup(deviceId, 'devices');
      await signalRConfig.addUserToGroup(deviceId, `device-${deviceId}`);
      await signalRConfig.addUserToGroup(deviceId, `mode-${mode.toLowerCase()}`);
      
      console.log(`Device ${deviceId} added to groups for mode ${mode}`);
    } catch (error) {
      console.error(`Failed to add device ${deviceId} to groups:`, error);
    }
  }

  public async removeDeviceFromGroups(connectionId: string, deviceId: string, mode: DeviceMode): Promise<void> {
    try {
      await signalRConfig.removeUserFromGroup(deviceId, 'devices');
      await signalRConfig.removeUserFromGroup(deviceId, `device-${deviceId}`);
      await signalRConfig.removeUserFromGroup(deviceId, `mode-${mode.toLowerCase()}`);
      
      console.log(`Device ${deviceId} removed from groups`);
    } catch (error) {
      console.error(`Failed to remove device ${deviceId} from groups:`, error);
    }
  }

  public async addDashboardToGroup(connectionId: string): Promise<void> {
    try {
      // In serverless mode, we use userId instead of connectionId
      await signalRConfig.addUserToGroup(connectionId, 'dashboard');
      console.log(`Dashboard connection ${connectionId} added to group`);
    } catch (error) {
      console.error(`Failed to add dashboard connection ${connectionId} to group:`, error);
    }
  }

  public async removeDashboardFromGroup(connectionId: string): Promise<void> {
    try {
      await signalRConfig.removeUserFromGroup(connectionId, 'dashboard');
      console.log(`Dashboard connection ${connectionId} removed from group`);
    } catch (error) {
      console.error(`Failed to remove dashboard connection ${connectionId} from group:`, error);
    }
  }

  public async addDashboardUserToGroup(connectionId: string, userId: string): Promise<void> {
    try {
      await signalRConfig.addUserToGroup(userId, 'dashboard');
      console.log(`Dashboard user ${userId} added to group`);
    } catch (error) {
      console.error(`Failed to add dashboard user ${userId} to group:`, error);
    }
  }

  public async removeDashboardUserFromGroup(connectionId: string, userId: string): Promise<void> {
    try {
      await signalRConfig.removeUserFromGroup(userId, 'dashboard');
      console.log(`Dashboard user ${userId} removed from group`);
    } catch (error) {
      console.error(`Failed to remove dashboard user ${userId} from group:`, error);
    }
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
