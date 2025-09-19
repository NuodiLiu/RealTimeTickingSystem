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

  async connect(userId?: string): Promise<void> {
    if (this.isConnecting || this.connection?.state === 'Connected') {
      return;
    }

    this.isConnecting = true;
    
    try {
      // Get connection URL and token from backend
      const response = await fetch('/api/signalr/dashboard/connect', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': this.config.accessToken ? `Bearer ${this.config.accessToken}` : '',
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get SignalR connection info: ${response.statusText}`);
      }

      const { url, token } = await response.json();

      // Build connection
      const connectionBuilder = new HubConnectionBuilder()
        .withUrl(url, {
          accessTokenFactory: () => token
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
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    dashboardSignalR = new SignalRService({
      url: apiUrl,
      automaticReconnect: true,
      logLevel: process.env.NODE_ENV === 'development' ? LogLevel.Debug : LogLevel.Information
    });
  }
  return dashboardSignalR;
}

export default SignalRService;
