import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

export interface SignalREvent {
  type: string;
  payload: any;
}

export interface SignalRConfig {
  url: string;
  accessToken?: string;
  automaticReconnect?: boolean;
  logLevel?: LogLevel;
}

export class SignalRService {
  private connection: HubConnection | null = null;
  private config: SignalRConfig;
  private eventHandlers: Map<string, ((event: SignalREvent) => void)[]> = new Map();
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: SignalRConfig) {
    this.config = {
      automaticReconnect: true,
      logLevel: LogLevel.Information,
      ...config
    };
  }

  private async fetchWithRetry(url: string, init?: RequestInit, retryCount = 0): Promise<Response> {
    const maxRetries = 2;
    
    try {
      const response = await fetch(url, init);
      
      // Retry on 503 (service unavailable) or 502 (bad gateway) for cold start issues
      if ((response.status === 503 || response.status === 502) && retryCount < maxRetries) {
        console.warn(`Azure Functions cold start detected (${response.status}), retrying... (${retryCount + 1}/${maxRetries})`);
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.fetchWithRetry(url, init, retryCount + 1);
      }
      
      return response;
    } catch (error) {
      // Retry on network errors that might be cold start related
      if (retryCount < maxRetries && (
        (error as Error).message?.includes('fetch') || 
        (error as Error).message?.includes('Network request failed')
      )) {
        console.warn(`Network error detected, retrying... (${retryCount + 1}/${maxRetries})`, (error as Error).message);
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.fetchWithRetry(url, init, retryCount + 1);
      }
      
      throw error;
    }
  }

  async connect(userId?: string, userType: 'dashboard' | 'device' = 'dashboard'): Promise<void> {
    if (this.isConnecting || this.connection?.state === 'Connected') {
      return;
    }

    this.isConnecting = true;
    
    try {
      // Get connection URL and token from Azure Functions negotiate endpoint
      const negotiateUrl = process.env.NEXT_PUBLIC_API_URL 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/negotiate`
        : '/api/negotiate';
      
      // Build URL with query parameters
      const urlWithParams = new URL(negotiateUrl, window.location.origin);
      if (userType) urlWithParams.searchParams.set('userType', userType);
      if (userId) urlWithParams.searchParams.set('userId', userId);
      
      const response = await this.fetchWithRetry(urlWithParams.toString(), {
        method: 'POST',
        headers: {
          'Authorization': this.config.accessToken ? `Bearer ${this.config.accessToken}` : '',
          'Content-Type': 'application/json',
          'x-user-id': userId || 'anonymous',
          'x-user-type': userType
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get SignalR connection info: ${response.statusText}`);
      }

      const { url, accessToken } = await response.json();

      // Build connection with Azure SignalR Service
      const connectionBuilder = new HubConnectionBuilder()
        .withUrl(url, {
          accessTokenFactory: () => accessToken
        })
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
      console.log('SignalR Dashboard connected');
      
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('SignalR connection failed:', error);
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
      console.log('SignalR connection closed', error);
      this.handleConnectionError();
    });

    this.connection.onreconnecting(() => {
      console.log('SignalR reconnecting...');
    });

    this.connection.onreconnected(() => {
      console.log('SignalR reconnected');
      this.reconnectAttempts = 0;
    });

    // Handle incoming messages
    this.connection.on('caseUpdated', (payload: any) => {
      this.emit({ type: 'case:updated', payload });
    });

    this.connection.on('caseCreated', (payload: any) => {
      this.emit({ type: 'case:created', payload });
    });

    this.connection.on('deviceUpdated', (payload: any) => {
      this.emit({ type: 'device:updated', payload });
    });

    this.connection.on('deviceConnected', (payload: any) => {
      this.emit({ type: 'device:connected', payload });
    });

    this.connection.on('deviceDisconnected', (payload: any) => {
      this.emit({ type: 'device:disconnected', payload });
    });

    this.connection.on('deviceStatus', (payload: any) => {
      this.emit({ type: 'device:status', payload });
    });

    // Generic message handler
    this.connection.on('message', (message: any) => {
      console.log('SignalR message received:', message);
      if (message.type) {
        this.emit(message);
      }
    });
  }

  private handleConnectionError(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.config.automaticReconnect) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  private emit(event: SignalREvent): void {
    const handlers = this.eventHandlers.get(event.type) || [];
    const allHandlers = this.eventHandlers.get('*') || [];
    
    [...handlers, ...allHandlers].forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in SignalR event handler:', error);
      }
    });
  }

  on(eventType: string, handler: (event: SignalREvent) => void): () => void {
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

  off(eventType: string, handler?: (event: SignalREvent) => void): void {
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

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
    this.eventHandlers.clear();
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  async sendMessage(message: SignalREvent): Promise<void> {
    if (!this.connection || this.connection.state !== 'Connected') {
      throw new Error('SignalR connection is not established');
    }

    try {
      await this.connection.invoke('SendMessage', message);
      console.log('Message sent via SignalR:', message.type);
    } catch (error) {
      console.error('Failed to send SignalR message:', error);
      throw error;
    }
  }

  async sendToDevice(deviceId: string, message: SignalREvent): Promise<void> {
    return this.sendMessage({
      type: 'SendToDevice',
      payload: {
        deviceId,
        message
      }
    });
  }

  async sendToGroup(groupName: string, message: SignalREvent): Promise<void> {
    return this.sendMessage({
      type: 'SendToGroup',
      payload: {
        groupName,
        message
      }
    });
  }

  get state(): string {
    return this.connection?.state || 'Disconnected';
  }

  get isConnected(): boolean {
    return this.connection?.state === 'Connected';
  }
}

// Singleton instance for dashboard
let dashboardSignalR: SignalRService | null = null;

export function getDashboardSignalR(): SignalRService {
  if (!dashboardSignalR) {
    // Use Azure Functions API URL for SignalR negotiation
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7071';
    const accessToken = localStorage.getItem('access_token');
    
    dashboardSignalR = new SignalRService({
      url: apiUrl,
      accessToken: accessToken || undefined,
      automaticReconnect: true,
      logLevel: process.env.NODE_ENV === 'development' ? LogLevel.Debug : LogLevel.Information
    });
  }
  return dashboardSignalR;
}

export default SignalRService;
