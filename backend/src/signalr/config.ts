import { WebPubSubServiceClient } from '@azure/web-pubsub';
import { SignalRConfig } from './types';

export class SignalRConfiguration {
  private static instance: SignalRConfiguration;
  private config: SignalRConfig;
  private serviceClient: WebPubSubServiceClient;

  private constructor() {
    this.config = {
      connectionString: process.env.AZURE_WEB_PUBSUB_CONNECTION_STRING || '',
      hubName: process.env.AZURE_WEB_PUBSUB_HUB_NAME || 'ticketing-hub'
    };

    if (!this.config.connectionString) {
      throw new Error('Azure Web PubSub connection string is required. Please set AZURE_WEB_PUBSUB_CONNECTION_STRING in your environment variables.');
    }

    this.serviceClient = new WebPubSubServiceClient(
      this.config.connectionString,
      this.config.hubName
    );
  }

  public static getInstance(): SignalRConfiguration {
    if (!SignalRConfiguration.instance) {
      SignalRConfiguration.instance = new SignalRConfiguration();
    }
    return SignalRConfiguration.instance;
  }

  public getConfig(): SignalRConfig {
    return this.config;
  }

  public getServiceClient(): WebPubSubServiceClient {
    return this.serviceClient;
  }

  public getDeviceHub(): string {
    return 'devices';
  }

  public getDashboardHub(): string {
    return 'dashboard';
  }

  public async getConnectionUrl(userId: string, groups?: string[]): Promise<string> {
    const options: any = {
      userId,
      expirationTimeInMinutes: 60
    };
    
    if (groups) {
      options.groups = groups;
    }
    
    const token = await this.serviceClient.getClientAccessToken(options);
    return token.url;
  }

  public async getDeviceConnectionUrl(deviceId: string): Promise<string> {
    return this.getConnectionUrl(deviceId, ['devices', `device-${deviceId}`]);
  }

  public async getDashboardConnectionUrl(userId: string): Promise<string> {
    return this.getConnectionUrl(userId, ['dashboard']);
  }
}

export const signalRConfig = SignalRConfiguration.getInstance();
