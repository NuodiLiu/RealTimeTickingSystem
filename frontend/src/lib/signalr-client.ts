// Updated SignalR Client for Azure Web PubSub Serverless
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export interface SignalREvent {
  type: string;
  payload: any;
}

export interface SignalRConfig {
  url?: string;
  automaticReconnect?: boolean;
  logLevel?: LogLevel;
}

export class AzureWebPubSubClient {
  private connection: HubConnection | null = null;
  private config: SignalRConfig;
  private eventHandlers: Map<string, ((event: SignalREvent) => void)[]> = new Map();
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: SignalRConfig = {}) {
    this.config = {
      automaticReconnect: true,
      logLevel: LogLevel.Information,
      ...config
    };
  }

  async connect(userId?: string): Promise<void> {
    if (this.isConnecting || this.connection?.state === 'Connected') {
      return;
    }

    this.isConnecting = true;
    
    try {
      console.log('Fetching Azure Web PubSub connection info...');
      
      // Get connection URL and token from backend
      const response = await fetch(`${API_BASE}/api/signalr/dashboard/connect`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log('SignalR connection response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('SignalR connection response error:', errorText);
        throw new Error(`Failed to get SignalR connection info: ${response.statusText}`);
      }

      const connectionInfo = await response.json();
      console.log('SignalR connection info received:', { url: connectionInfo.url?.substring(0, 50) + '...' });

      // Build Azure Web PubSub connection using SignalR client
      // Note: Azure Web PubSub supports SignalR protocol
      const connectionBuilder = new HubConnectionBuilder()
        .withUrl(connectionInfo.url)
        .configureLogging(this.config.logLevel!);

      if (this.config.automaticReconnect) {
        connectionBuilder.withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            // Exponential backoff with jitter
            const delay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
            return delay + Math.random() * 1000;
          }
        });
      }

      this.connection = connectionBuilder.build();

      // Set up event handlers
      this.setupEventHandlers();

      // Start connection
      await this.connection.start();
      console.log('Azure Web PubSub connected successfully');
      
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('Azure Web PubSub connection failed:', error);
      this.handleConnectionError();
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  private setupEventHandlers(): void {
    if (!this.connection) return;

    // Handle connection events
    this.connection.onclose((error) => {
      console.log('Azure Web PubSub connection closed', error);
      this.handleConnectionError();
    });

    this.connection.onreconnecting(() => {
      console.log('Azure Web PubSub reconnecting...');
    });

    this.connection.onreconnected(() => {
      console.log('Azure Web PubSub reconnected');
    });

    // Handle different event types from the server
    // Case events
    this.connection.on('caseUpdated', (payload) => {
      this.emit({ type: 'caseUpdated', payload });
    });

    // Device events
    this.connection.on('deviceUpdated', (payload) => {
      this.emit({ type: 'deviceUpdated', payload });
    });

    this.connection.on('deviceConnected', (payload) => {
      this.emit({ type: 'deviceConnected', payload });
    });

    this.connection.on('deviceDisconnected', (payload) => {
      this.emit({ type: 'deviceDisconnected', payload });
    });

    // Generic message handler
    this.connection.on('message', (type: string, payload: any) => {
      this.emit({ type, payload });
    });

    // Handle raw JSON messages (for backward compatibility)
    this.connection.on('json', (data: any) => {
      try {
        if (data && data.type) {
          this.emit(data);
        }
      } catch (error) {
        console.error('Error handling JSON message:', error);
      }
    });
  }

  private handleConnectionError() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.config.automaticReconnect) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  emit(event: SignalREvent) {
    const handlers = this.eventHandlers.get(event.type) || [];
    const allHandlers = this.eventHandlers.get('*') || [];
    [...handlers, ...allHandlers].forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in SignalR event handler:', error);
      }
    });
  }

  on(eventType: string, handler: (event: SignalREvent) => void) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  off(eventType: string, handler?: (event: SignalREvent) => void) {
    if (!handler) {
      this.eventHandlers.delete(eventType);
      return;
    }
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
    this.eventHandlers.clear();
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  get state() {
    return this.connection?.state || 'Disconnected';
  }

  get isConnected() {
    return this.connection?.state === 'Connected';
  }

  // Send message to server (if needed)
  async send(methodName: string, ...args: any[]) {
    if (this.connection && this.isConnected) {
      await this.connection.send(methodName, ...args);
    } else {
      console.warn('Cannot send message: SignalR not connected');
    }
  }
}

// Singleton instance for dashboard
let dashboardSignalR: AzureWebPubSubClient | null = null;

export function getDashboardSignalR(): AzureWebPubSubClient {
  if (!dashboardSignalR) {
    dashboardSignalR = new AzureWebPubSubClient({
      automaticReconnect: true,
      logLevel: LogLevel.Information
    });
  }
  return dashboardSignalR;
}

// Device SignalR client (for kiosk apps)
export class DeviceSignalRClient {
  private connection: HubConnection | null = null;
  private deviceId: string;
  private mode: 'REGISTRATION' | 'FEEDBACK';

  constructor(deviceId: string, mode: 'REGISTRATION' | 'FEEDBACK' = 'REGISTRATION') {
    this.deviceId = deviceId;
    this.mode = mode;
  }

  async connect(): Promise<void> {
    try {
      console.log(`Connecting device ${this.deviceId} to Azure Web PubSub...`);
      
      // Get device connection info from backend
      const response = await fetch(`${API_BASE}/api/signalr/device/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: this.deviceId,
          mode: this.mode
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get device connection info: ${response.statusText}`);
      }

      const { url } = await response.json();

      // Build connection
      this.connection = new HubConnectionBuilder()
        .withUrl(url)
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Information)
        .build();

      // Set up device event handlers
      this.setupDeviceEventHandlers();

      await this.connection.start();
      console.log(`Device ${this.deviceId} connected to Azure Web PubSub`);
      
    } catch (error) {
      console.error('Device SignalR connection failed:', error);
      throw error;
    }
  }

  private setupDeviceEventHandlers(): void {
    if (!this.connection) return;

    this.connection.on('showFeedback', (payload) => {
      console.log('Received show feedback:', payload);
      // Handle show feedback
    });

    this.connection.on('dismiss', () => {
      console.log('Received dismiss command');
      // Handle dismiss
    });

    this.connection.on('ping', (payload) => {
      console.log('Received ping:', payload);
      // Send pong back
      this.sendPong(payload);
    });

    this.connection.on('lockAssigned', (payload) => {
      console.log('Received lock assigned:', payload);
      // Handle lock assignment
    });

    this.connection.on('modeChanged', (payload) => {
      console.log('Mode changed:', payload);
      this.mode = payload.mode;
    });

    this.connection.on('unpaired', () => {
      console.log('Device unpaired');
      // Handle unpair
    });
  }

  async sendPong(payload?: any): Promise<void> {
    if (this.connection && this.connection.state === 'Connected') {
      await this.connection.send('pong', payload);
    }
  }

  async sendDelivered(sessionId: string): Promise<void> {
    if (this.connection && this.connection.state === 'Connected') {
      await this.connection.send('delivered', { sessionId });
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }
}

export default AzureWebPubSubClient;
