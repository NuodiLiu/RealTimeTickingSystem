import { AuthedDevice, DeviceMode } from './types';

interface SignalRConnectionInfo {
  url: string;
  accessToken: string;
}

interface SignalRConfig {
  generateAccessToken(userId: string, roles?: string[]): string;
  getConnectionInfo(userId: string, hub?: string): SignalRConnectionInfo;
  sendToDevice(deviceId: string, message: any): Promise<void>;
  sendToDashboard(message: any): Promise<void>;
  sendToGroup(group: string, message: any): Promise<void>;
  sendToUser(userId: string, message: any): Promise<void>;
}

import jwt from 'jsonwebtoken';

interface SignalRConnectionInfo {
  url: string;
  accessToken: string;
}

interface SignalRConfig {
  generateAccessToken(userId: string, roles?: string[]): string;
  getConnectionInfo(userId: string, hub?: string): SignalRConnectionInfo;
  sendToDevice(deviceId: string, message: any): Promise<void>;
  sendToDashboard(message: any): Promise<void>;
  sendToGroup(group: string, message: any): Promise<void>;
  sendToUser(userId: string, message: any): Promise<void>;
}

class AzureSignalRServiceConfig implements SignalRConfig {
  private connectionString: string;
  private hubName: string;
  private endpoint: string;
  private accessKey: string;

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

  private parseConnectionString(connectionString: string): { endpoint: string; accessKey: string } {
    const parts = connectionString.split(';');
    let endpoint = '';
    let accessKey = '';

    for (const part of parts) {
      if (part.startsWith('Endpoint=')) {
        endpoint = part.substring('Endpoint='.length);
      } else if (part.startsWith('AccessKey=')) {
        accessKey = part.substring('AccessKey='.length);
      }
    }

    if (!endpoint || !accessKey) {
      throw new Error('Invalid Azure SignalR connection string format');
    }

    return { endpoint, accessKey };
  }

  generateAccessToken(userId: string, roles: string[] = ['signalr.client']): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (60 * 60); // 1 hour

    const payload = {
      aud: this.endpoint,
      iat: now,
      exp: exp,
      nameid: userId,
      role: roles
    };

    return jwt.sign(payload, this.accessKey, { algorithm: 'HS256' });
  }

  getConnectionInfo(userId: string, hub?: string): SignalRConnectionInfo {
    const hubName = hub || this.hubName;
    const accessToken = this.generateAccessToken(userId);
    const url = `${this.endpoint}/client/?hub=${hubName}`;

    console.log(`Generated connection info for user: ${userId}, hub: ${hubName}`);
    
    return {
      url,
      accessToken
    };
  }

  async sendToDevice(deviceId: string, message: any): Promise<void> {
    await this.sendToUser(deviceId, message);
  }

  async sendToDashboard(message: any): Promise<void> {
    await this.sendToGroup('dashboard', message);
  }

  async sendToGroup(group: string, message: any): Promise<void> {
    try {
      const url = `${this.endpoint}/api/v1/hubs/${this.hubName}/groups/${group}`;
      const token = this.generateAccessToken('server', ['signalr.service']);

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
    } catch (error) {
      console.error(`Failed to send message to group ${group}:`, error);
      throw error;
    }
  }

  async sendToUser(userId: string, message: any): Promise<void> {
    try {
      const url = `${this.endpoint}/api/v1/hubs/${this.hubName}/users/${userId}`;
      const token = this.generateAccessToken('server', ['signalr.service']);

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
    } catch (error) {
      console.error(`Failed to send message to user ${userId}:`, error);
      throw error;
    }
  }

  async addUserToGroup(userId: string, group: string): Promise<void> {
    try {
      const url = `${this.endpoint}/api/v1/hubs/${this.hubName}/groups/${group}/users/${userId}`;
      const token = this.generateAccessToken('server', ['signalr.service']);

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
    } catch (error) {
      console.error(`Failed to add user ${userId} to group ${group}:`, error);
      throw error;
    }
  }

  async removeUserFromGroup(userId: string, group: string): Promise<void> {
    try {
      const url = `${this.endpoint}/api/v1/hubs/${this.hubName}/groups/${group}/users/${userId}`;
      const token = this.generateAccessToken('server', ['signalr.service']);

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
    } catch (error) {
      console.error(`Failed to remove user ${userId} from group ${group}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const signalRConfig = new AzureSignalRServiceConfig();

// Export for testing or custom configurations
export { AzureSignalRServiceConfig };

// Environment validation
export function validateSignalREnvironment(): boolean {
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
export function generateDeviceConnectionInfo(deviceId: string): SignalRConnectionInfo {
  return signalRConfig.getConnectionInfo(deviceId);
}

export function generateDashboardConnectionInfo(userId: string): SignalRConnectionInfo {
  return signalRConfig.getConnectionInfo(userId);
}
