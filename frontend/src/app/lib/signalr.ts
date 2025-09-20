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

  private async negotiateConnection(userId?: string, userType: 'dashboard' | 'device' = 'dashboard'): Promise<{ url: string; accessToken: string }> {
    // Get connection URL and token from Azure Functions negotiate endpoint
    const negotiateUrl = process.env.NEXT_PUBLIC_API_URL 
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/negotiate`
      : '/api/negotiate';
    
    console.log('🌐 [SignalR Negotiate] Base URL:', negotiateUrl);
    
    // Build URL with query parameters
    const urlWithParams = new URL(negotiateUrl, window.location.origin);
    if (userType) urlWithParams.searchParams.set('userType', userType);
    if (userId) urlWithParams.searchParams.set('userId', userId);
    
    console.log('🌐 [SignalR Negotiate] Full URL:', urlWithParams.toString());
    
    const headers = {
      'Authorization': this.config.accessToken ? `Bearer ${this.config.accessToken}` : '',
      'Content-Type': 'application/json',
      'x-user-id': userId || 'anonymous',
      'x-user-type': userType
    };
    
    console.log('📤 [SignalR Negotiate] Request headers:', {
      ...headers,
      'Authorization': headers.Authorization ? `Bearer ${headers.Authorization.substring(7, 20)}...` : 'Missing'
    });
    
    const response = await this.fetchWithRetry(urlWithParams.toString(), {
      method: 'POST',
      headers
    });

    console.log('📥 [SignalR Negotiate] Response status:', response.status);
    console.log('📥 [SignalR Negotiate] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [SignalR Negotiate] Error response body:', errorText);
      
      // Try to parse error response
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      // Handle JWT expiration specially
      if (response.status === 401 && errorData.code === 'TOKEN_EXPIRED') {
        console.warn('🕒 [SignalR Negotiate] JWT token expired, attempting to refresh...');
        
        // Try to refresh the token
        try {
          // Import the refresh function
          const { refreshAppJwt } = await import('./api');
          await refreshAppJwt();
          
          // Update the access token in the current instance
          const newAppJwt = localStorage.getItem('appJwt');
          if (newAppJwt) {
            this.config.accessToken = newAppJwt;
            console.log('✅ [SignalR Negotiate] JWT refreshed, retrying negotiate...');
            
            // Retry the negotiate request with the new token
            const retryResponse = await this.fetchWithRetry(urlWithParams.toString(), {
              method: 'POST',
              headers: {
                ...headers,
                'Authorization': `Bearer ${newAppJwt}`
              }
            });
            
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              console.log('✅ [SignalR Negotiate] Retry succeeded after JWT refresh');
              return { url: retryData.url, accessToken: retryData.accessToken };
            }
          }
        } catch (refreshError) {
          console.error('❌ [SignalR Negotiate] JWT refresh failed:', refreshError);
        }
        
        // If refresh failed, clear expired token and throw error
        localStorage.removeItem('appJwt');
        throw new Error('JWT_EXPIRED: Your session has expired. Please log in again.');
      }
      
      throw new Error(`Failed to get SignalR connection info: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log('✅ [SignalR Negotiate] Success response:', {
      url: responseData.url,
      accessTokenPresent: !!responseData.accessToken,
      accessTokenLength: responseData.accessToken?.length || 0,
      accessTokenPreview: responseData.accessToken ? responseData.accessToken.substring(0, 30) + '...' : 'Missing'
    });
    
    return { url: responseData.url, accessToken: responseData.accessToken };
  }

  async connect(userId?: string, userType: 'dashboard' | 'device' = 'dashboard'): Promise<void> {
    if (this.isConnecting || this.connection?.state === 'Connected') {
      console.log('🔄 [SignalR Connect] Already connecting or connected, skipping...');
      return;
    }

    this.isConnecting = true;
    
    try {
      console.log('🚀 [SignalR Connect] Starting connection process...');
      console.log('🚀 [SignalR Connect] UserId:', userId);
      console.log('🚀 [SignalR Connect] UserType:', userType);
      console.log('🚀 [SignalR Connect] Access Token present:', !!this.config.accessToken);
      
      const { url, accessToken } = await this.negotiateConnection(userId, userType);

      console.log('🔗 [SignalR Connection] Building connection to Azure SignalR...');
      console.log('🔗 [SignalR Connection] SignalR URL:', url);
      console.log('🔗 [SignalR Connection] Using access token for connection...');

      // Build connection with Azure SignalR Service
      const connectionBuilder = new HubConnectionBuilder()
        .withUrl(url, {
          accessTokenFactory: () => {
            console.log('🔑 [SignalR AccessToken] Providing access token to Azure SignalR...');
            return accessToken;
          },
          // Add CORS and other options for cross-origin requests
          skipNegotiation: false,
          withCredentials: false, // 关键：不使用凭据，避免 CORS 复杂性
          headers: {
            'Origin': window.location.origin
          }
        })
        .configureLogging(this.config.logLevel!);

      if (this.config.automaticReconnect) {
        connectionBuilder.withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            // Exponential backoff with jitter
            const delay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
            console.log(`🔄 [SignalR Reconnect] Attempt ${retryContext.previousRetryCount + 1}, delay: ${delay}ms`);
            return delay + Math.random() * 1000;
          }
        });
      }

      this.connection = connectionBuilder.build();

      // Set up event handlers
      this.setupEventHandlers();

      console.log('🔌 [SignalR Connection] Starting connection to Azure SignalR Service...');
      // Start connection
      await this.connection.start();
      console.log('✅ [SignalR Connection] Successfully connected to Azure SignalR Service!');
      
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('❌ [SignalR Connection] Connection failed:', error);
      if (error instanceof Error) {
        console.error('❌ [SignalR Connection] Error message:', error.message);
        console.error('❌ [SignalR Connection] Error stack:', error.stack);
      }
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

  updateAccessToken(newToken: string): void {
    console.log('🔄 [SignalR] Updating access token');
    this.config.accessToken = newToken;
  }

  getCurrentAccessToken(): string | undefined {
    return this.config.accessToken;
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
    const appJwt = localStorage.getItem('appJwt');
    
    console.log('🔧 [SignalR Init] API URL:', apiUrl);
    console.log('🔧 [SignalR Init] App JWT present:', !!appJwt);
    console.log('🔧 [SignalR Init] App JWT length:', appJwt?.length || 0);
    if (appJwt) {
      console.log('🔧 [SignalR Init] App JWT preview:', appJwt.substring(0, 50) + '...');
    }
    
    dashboardSignalR = new SignalRService({
      url: apiUrl,
      accessToken: appJwt || undefined,
      automaticReconnect: true,
      logLevel: process.env.NODE_ENV === 'development' ? LogLevel.Debug : LogLevel.Information
    });
  } else {
    // Update the access token in case it was refreshed
    const currentAppJwt = localStorage.getItem('appJwt');
    if (currentAppJwt && currentAppJwt !== dashboardSignalR.getCurrentAccessToken()) {
      console.log('🔄 [SignalR Update] Updating access token with refreshed JWT');
      dashboardSignalR.updateAccessToken(currentAppJwt);
    }
  }
  return dashboardSignalR;
}

// Function to reset SignalR instance (useful when JWT is refreshed)
export function resetDashboardSignalR(): void {
  console.log('🔄 [SignalR Reset] Resetting SignalR instance');
  if (dashboardSignalR) {
    dashboardSignalR.disconnect().catch(error => {
      console.error('Error disconnecting old SignalR instance:', error);
    });
  }
  dashboardSignalR = null;
}

export default SignalRService;
