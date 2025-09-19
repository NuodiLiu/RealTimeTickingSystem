// Azure SignalR Service Serverless Mode Client
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export interface SignalREvent {
  type: string;
  payload: any;
}

export interface SignalRConfig {
  url: string;
  automaticReconnect?: boolean;
}

export class AzureSignalRServerlessClient {
  private ws: WebSocket | null = null;
  private config: SignalRConfig;
  private eventHandlers: Map<string, ((event: SignalREvent) => void)[]> = new Map();
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: SignalRConfig) {
    this.config = {
      automaticReconnect: true,
      ...config
    };
  }

  async connect(userId?: string): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    
    try {
      // Get connection URL from backend
      console.log('Fetching Azure SignalR connection info from:', `${API_BASE}/api/signalr/dashboard/connect`);
      const response = await fetch(`${API_BASE}/api/signalr/dashboard/connect`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log('Azure SignalR connection response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure SignalR connection response error:', errorText);
        throw new Error(`Failed to get SignalR connection info: ${response.statusText}`);
      }

      const { url, userId: connectedUserId } = await response.json();
      console.log('Azure SignalR connection URL received:', url);

      // Create WebSocket connection with Azure SignalR subprotocol
      this.ws = new WebSocket(url, 'json.webpubsub.azure.v1');
      
      this.ws.onopen = () => {
        console.log('Azure SignalR connected successfully');
        this.reconnectAttempts = 0;
        
        // Join dashboard group for receiving messages
        this.sendMessage({
          type: 'joinGroup',
          group: 'dashboard'
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Azure SignalR raw message:', message);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing Azure SignalR message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('Azure SignalR connection closed:', event.code, event.reason);
        this.handleConnectionError();
      };

      this.ws.onerror = (error) => {
        console.error('Azure SignalR connection error:', error);
        this.handleConnectionError();
      };

    } catch (error) {
      console.error('Azure SignalR connection failed:', error);
      this.handleConnectionError();
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  private handleMessage(message: any) {
    // Handle different Azure SignalR message types
    switch (message.type) {
      case 'message':
        // This is a user message
        if (message.data) {
          // Try to parse the data as an event
          let eventData = message.data;
          if (typeof eventData === 'string') {
            try {
              eventData = JSON.parse(eventData);
            } catch (e) {
              // If it's not JSON, treat as simple message
              eventData = { type: 'message', payload: eventData };
            }
          }
          this.emit(eventData);
        }
        break;
      case 'system':
        if (message.event === 'connected') {
          console.log('Azure SignalR system: connected');
        } else if (message.event === 'disconnected') {
          console.log('Azure SignalR system: disconnected');
        }
        break;
      default:
        // Treat unknown messages as events
        if (message.type && message.payload !== undefined) {
          this.emit(message);
        }
        break;
    }
  }

  private sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
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
        console.error('Error in Azure SignalR event handler:', error);
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.eventHandlers.clear();
    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  get state() {
    if (!this.ws) return 'Disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'Connecting';
      case WebSocket.OPEN: return 'Connected';
      case WebSocket.CLOSING: return 'Disconnecting';
      case WebSocket.CLOSED: return 'Disconnected';
      default: return 'Unknown';
    }
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance for dashboard
let dashboardSignalR: AzureSignalRServerlessClient | null = null;

export function getDashboardSignalR(): AzureSignalRServerlessClient {
  if (!dashboardSignalR) {
    dashboardSignalR = new AzureSignalRServerlessClient({
      url: API_BASE,
      automaticReconnect: true
    });
  }
  return dashboardSignalR;
}

export default AzureSignalRServerlessClient;
