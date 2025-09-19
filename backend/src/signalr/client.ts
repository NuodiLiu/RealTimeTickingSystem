import { WebPubSubServiceClient } from '@azure/web-pubsub';
import { signalRConfig } from './config';
import { 
  ServerToDevice, 
  DeviceToServer,
  DeviceMode,
  FeedbackShowPayload,
  SignalRMessage
} from './types';

export class SignalRClient {
  private serviceClient: WebPubSubServiceClient;
  
  constructor() {
    this.serviceClient = signalRConfig.getServiceClient();
  }

  // Message Sending Methods - Serverless compatible (no state management)
  public async sendToDevice(deviceId: string, message: ServerToDevice): Promise<boolean> {
    try {
      // Send directly to user (device) by userId
      await this.serviceClient.sendToUser(deviceId, message);
      console.log(`Message sent to device ${deviceId}:`, message.type);
      return true;
    } catch (error) {
      console.error(`Failed to send message to device ${deviceId}:`, error);
      return false;
    }
  }

  public async sendToDashboard(message: any): Promise<void> {
    try {
      await this.serviceClient.group('dashboard').sendToAll(message);
      console.log(`Message sent to dashboard:`, message.type);
    } catch (error) {
      console.error(`Failed to send message to dashboard:`, error);
    }
  }

  public async broadcastToDevices(message: ServerToDevice, mode?: DeviceMode): Promise<void> {
    try {
      const targetGroup = mode ? `mode-${mode.toLowerCase()}` : 'devices';
      await this.serviceClient.group(targetGroup).sendToAll(message);
      console.log(`Broadcast message sent to ${targetGroup}:`, message.type);
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

  public async assignLockToDevice(deviceId: string, payload: any): Promise<boolean> {
    return this.sendToDevice(deviceId, { type: "LOCK_ASSIGNED", payload });
  }

  public async changeModeDevice(deviceId: string, mode: DeviceMode): Promise<boolean> {
    const success = await this.sendToDevice(deviceId, { type: 'MODE_CHANGED', payload: { mode } });
    
    if (success) {
      // In serverless, we need to manage groups via database or external state
      // For now, we'll just send the message and let webhook handlers manage groups
      console.log(`Mode change message sent to device ${deviceId}: ${mode}`);
    }
    
    return success;
  }

  public async unpairDevice(deviceId: string): Promise<boolean> {
    return this.sendToDevice(deviceId, { type: 'UNPAIRED' });
  }

  // Dashboard notification methods
  public async notifyDashboard(message: { type: string; payload: any }): Promise<void> {
    await this.sendToDashboard(message);
  }

  // Health check and maintenance - serverless compatible
  public async pingAllDevices(): Promise<void> {
    const now = new Date().toISOString();
    await this.broadcastToDevices({ type: "PING", payload: { now } });
  }

  // Serverless-compatible methods (no local state)
  public async isDeviceConnected(deviceId: string): Promise<boolean> {
    try {
      // In serverless, we can't maintain connection state locally
      // We can check if the user exists in the service
      const result = await this.serviceClient.userExists(deviceId);
      return result;
    } catch (error) {
      console.error(`Error checking device connection for ${deviceId}:`, error);
      return false;
    }
  }

  public async getConnectionStats() {
    // In serverless, return minimal stats
    return {
      devices: 0, // Would need external state store for accurate count
      dashboard: 0,
      total: 0,
      serverless: true
    };
  }

  // Group management - serverless compatible  
  public async addDeviceToGroups(deviceId: string, connectionId: string, mode: DeviceMode): Promise<void> {
    try {
      await this.serviceClient.group('devices').addConnection(connectionId);
      await this.serviceClient.group(`device-${deviceId}`).addConnection(connectionId);
      await this.serviceClient.group(`mode-${mode.toLowerCase()}`).addConnection(connectionId);
      console.log(`Device ${deviceId} added to groups`);
    } catch (error) {
      console.error(`Failed to add device ${deviceId} to groups:`, error);
    }
  }

  public async removeDeviceFromGroups(deviceId: string, connectionId: string, mode: DeviceMode): Promise<void> {
    try {
      await this.serviceClient.group('devices').removeConnection(connectionId);
      await this.serviceClient.group(`device-${deviceId}`).removeConnection(connectionId);
      await this.serviceClient.group(`mode-${mode.toLowerCase()}`).removeConnection(connectionId);
      console.log(`Device ${deviceId} removed from groups`);
    } catch (error) {
      console.error(`Failed to remove device ${deviceId} from groups:`, error);
    }
  }

  public async addDashboardToGroup(connectionId: string): Promise<void> {
    try {
      await this.serviceClient.group('dashboard').addConnection(connectionId);
      console.log(`Dashboard connection ${connectionId} added to group`);
    } catch (error) {
      console.error(`Failed to add dashboard connection to group:`, error);
    }
  }

  public async removeDashboardFromGroup(connectionId: string): Promise<void> {
    try {
      await this.serviceClient.group('dashboard').removeConnection(connectionId);
      console.log(`Dashboard connection ${connectionId} removed from group`);
    } catch (error) {
      console.error(`Failed to remove dashboard connection from group:`, error);
    }
  }
}

// Singleton instance
export const signalRClient = new SignalRClient();
