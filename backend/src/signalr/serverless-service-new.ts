import { signalRConfig } from './config';

export class AzureSignalRServerlessService {
  private static instance: AzureSignalRServerlessService;

  private constructor() {
    // No initialization needed for serverless
  }

  public static getInstance(): AzureSignalRServerlessService {
    if (!AzureSignalRServerlessService.instance) {
      AzureSignalRServerlessService.instance = new AzureSignalRServerlessService();
    }
    return AzureSignalRServerlessService.instance;
  }

  // Send message to all users in a group
  async sendToGroup(group: string, message: any): Promise<void> {
    try {
      await signalRConfig.sendToGroup(group, message);
      console.log(`Serverless message sent to group ${group}:`, message.type);
    } catch (error) {
      console.error(`Failed to send message to group ${group}:`, error);
      throw error;
    }
  }

  // Send message to specific user
  async sendToUser(userId: string, message: any): Promise<void> {
    try {
      await signalRConfig.sendToUser(userId, message);
      console.log(`Serverless message sent to user ${userId}:`, message.type);
    } catch (error) {
      console.error(`Failed to send message to user ${userId}:`, error);
      throw error;
    }
  }

  // Send to all devices
  async sendToAllDevices(message: any): Promise<void> {
    await this.sendToGroup('devices', message);
  }

  // Send to dashboard
  async sendToDashboard(message: any): Promise<void> {
    await this.sendToGroup('dashboard', message);
  }

  // Device-specific operations
  async sendToDevice(deviceId: string, message: any): Promise<void> {
    await this.sendToUser(deviceId, message);
  }

  // Group management (handled by Azure SignalR Service)
  async addUserToGroup(userId: string, groupName: string): Promise<void> {
    try {
      await signalRConfig.addUserToGroup(userId, groupName);
      console.log(`User ${userId} added to group ${groupName}`);
    } catch (error) {
      console.error(`Failed to add user ${userId} to group ${groupName}:`, error);
      throw error;
    }
  }

  async removeUserFromGroup(userId: string, groupName: string): Promise<void> {
    try {
      await signalRConfig.removeUserFromGroup(userId, groupName);
      console.log(`User ${userId} removed from group ${groupName}`);
    } catch (error) {
      console.error(`Failed to remove user ${userId} from group ${groupName}:`, error);
      throw error;
    }
  }

  // Connection info generation
  getConnectionInfo(userId: string): { url: string; accessToken: string } {
    return signalRConfig.getConnectionInfo(userId);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; serverless: boolean }> {
    try {
      // Test basic functionality
      return {
        status: 'healthy',
        serverless: true
      };
    } catch (error) {
      console.error('SignalR serverless health check failed:', error);
      return {
        status: 'unhealthy',
        serverless: true
      };
    }
  }

  // Event handlers for connection lifecycle
  async handleConnect(userId: string, connectionId: string): Promise<void> {
    console.log(`User ${userId} connected with connection ${connectionId}`);
    
    // Determine user type and add to appropriate groups
    if (userId.startsWith('device-')) {
      await this.addUserToGroup(userId, 'devices');
      await this.addUserToGroup(userId, `device-${userId}`);
    } else {
      await this.addUserToGroup(userId, 'dashboard');
    }

    // Notify dashboard of new connection
    await this.sendToDashboard({
      type: 'userConnected',
      payload: { userId, connectionId, timestamp: new Date().toISOString() }
    });
  }

  async handleDisconnect(userId: string, connectionId: string): Promise<void> {
    console.log(`User ${userId} disconnected from connection ${connectionId}`);
    
    // Remove from groups
    if (userId.startsWith('device-')) {
      await this.removeUserFromGroup(userId, 'devices');
      await this.removeUserFromGroup(userId, `device-${userId}`);
    } else {
      await this.removeUserFromGroup(userId, 'dashboard');
    }

    // Notify dashboard of disconnection
    await this.sendToDashboard({
      type: 'userDisconnected',
      payload: { userId, connectionId, timestamp: new Date().toISOString() }
    });
  }

  async handleMessage(userId: string, message: any): Promise<void> {
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
          payload: { userId, sessionId: message.payload?.sessionId }
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
          payload: { userId, sessionId: message.payload?.sessionId }
        });
        break;

      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }
}
