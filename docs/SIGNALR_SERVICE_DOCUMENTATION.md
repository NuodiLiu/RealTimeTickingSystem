# SignalR Service and Gateway Center Documentation

## Overview

This document provides comprehensive documentation for the real-time communication system between iPad devices and the serverless backend using Azure SignalR Service. The architecture supports bidirectional communication for a ticketing/feedback system with device management capabilities.

## Architecture Overview

### System Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   iPad Devices  │◄────┤ Azure SignalR   │◄────┤ Serverless      │
│                 │     │ Service         │     │ Backend         │
│ - KioskApp      │     │                 │     │ (Azure Functions)│
│ - SignalRService│     │ - Hub: realtick │     │                 │
│ - GatewayCenter │     │ - User-based    │     │ - Negotiate     │
│                 │     │   messaging     │     │ - Event Handlers│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Authentication Flow

1. **Device Registration**: Device obtains API key during pairing
2. **App JWT Generation**: API key is exchanged for App JWT token
3. **SignalR Negotiation**: App JWT is used to get SignalR connection info
4. **Connection**: Device connects to Azure SignalR Service with access token

## Backend Architecture

### Core Components

#### 1. SignalR Gateway (`/backend/src/signalr/index.ts`)

The main interface that provides serverless-compatible SignalR communication:

```typescript
export class SignalRGateway {
  // Device Management
  static async isDeviceOnline(deviceId: string): Promise<boolean>
  static async getConnectionStats()
  
  // Message Sending
  static async sendToDevice(deviceId: string, message: ServerToDevice): Promise<boolean>
  static async showFeedback(deviceId: string, payload: FeedbackShowPayload): Promise<boolean>
  static async dismissDevice(deviceId: string): Promise<boolean>
  static async pingDevice(deviceId: string, payload?: { now: string }): Promise<boolean>
  static async assignLockToDevice(deviceId: string, payload: any): Promise<boolean>
  static async changeModeDevice(deviceId: string, mode: DeviceMode): Promise<boolean>
  static async unpairDevice(deviceId: string): Promise<boolean>
  static async broadcastToDevices(message: ServerToDevice, mode?: DeviceMode): Promise<void>
  
  // Dashboard Communication
  static async notifyDashboard(message: { type: string; payload: any }): Promise<void>
  
  // Event Handlers (called by Azure Web PubSub webhooks)
  static async handleDeviceConnect(deviceId: string, connectionId: string, mode: DeviceMode): Promise<void>
  static async handleDeviceDisconnect(deviceId: string, connectionId: string): Promise<void>
  static async handleDeviceMessage(deviceId: string, message: any): Promise<void>
  static async handleDashboardConnect(connectionId: string, userId?: string): Promise<void>
  static async handleDashboardDisconnect(connectionId: string): Promise<void>
}
```

#### 2. SignalR Configuration (`/backend/src/signalr/config.ts`)

Manages Azure SignalR Service connection and message routing:

```typescript
class AzureSignalRServiceConfig {
  // Connection management
  generateAccessToken(userId: string, roles?: string[]): string
  getConnectionInfo(userId: string, hub?: string, roles?: string[]): SignalRConnectionInfo
  
  // Message sending methods
  sendToDevice(deviceId: string, message: any): Promise<void>
  sendToDashboard(message: any): Promise<void>
  sendToGroup(group: string, message: any): Promise<void>
  sendToUser(userId: string, message: any): Promise<void>
}
```

### API Endpoints

#### 1. Negotiate Endpoint (`POST /api/negotiate`)

**Purpose**: Authenticates clients and provides SignalR connection information

**Request Headers**:
```http
Authorization: Bearer <APP_JWT_TOKEN>
Content-Type: application/json
```

**Query Parameters**:
- `userType` (optional): `"device"` or `"dashboard"` (defaults to `"dashboard"` for staff)

**Response**:
```json
{
  "url": "wss://ticketing-system.service.signalr.net/client/?hub=realtimeticket",
  "accessToken": "<AZURE_SIGNALR_ACCESS_TOKEN>",
  "user": {
    "id": "device-123",
    "email": "device@example.com", 
    "name": "Device 123",
    "type": "device"
  }
}
```

**Authentication Process**:
1. Validates App JWT token (signed by backend's JWT_SECRET)
2. Extracts user identity from JWT claims (`sub`, `typ`, `email`)
3. Generates Azure SignalR access token for the user
4. Returns connection URL and access token

#### 2. SignalR Event Handlers

**Connection Events**:
- `onConnected`: Handles new SignalR connections
- `onDisconnected`: Handles SignalR disconnections
- `onMessage`: Handles incoming messages from clients

**Webhook URLs**:
- `POST /api/signalr/onConnected`
- `POST /api/signalr/onDisconnected` 
- `POST /api/signalr/onMessage`

## Message Types and Schemas

### Server to Device Messages

```typescript
type ServerToDevice = 
  | { type: "SHOW_FEEDBACK"; payload: FeedbackShowPayload }
  | { type: "DISMISS" }
  | { type: "PING"; payload?: { now: string } }
  | { type: "LOCK_ASSIGNED"; payload: any }
  | { type: 'MODE_CHANGED'; payload: { mode: DeviceMode } }
  | { type: 'UNPAIRED' };
```

#### Message Details

**SHOW_FEEDBACK**:
```typescript
type FeedbackShowPayload = {
  sessionId: string;
  caseId: string;
  staff: { id: string; name: string | null };
  expireAt: string; // ISO timestamp
};
```

**MODE_CHANGED**:
```typescript
type DeviceMode = 'REGISTRATION' | 'FEEDBACK';
payload: { mode: DeviceMode }
```

### Device to Server Messages

```typescript
type DeviceToServer = 
  | { type: "PONG"; payload?: { now: string } }
  | { type: "DELIVERED"; payload: { sessionId: string } }
  | { type: "LEASE"; payload: { deviceId: string } }
  | { type: "STATUS"; payload?: never }
  | { type: "FEEDBACK_UPDATE"; payload?: any }
  | { type: "FEEDBACK_CANCELLED"; payload: { sessionId: string } };
```

### Dashboard Messages

**To Dashboard**:
```typescript
// Case updates
{ type: 'caseUpdated', payload: { id: string; status: string } }

// Device status updates  
{ type: 'deviceUpdated', payload: { id: string; isBusy: boolean; isOnline: boolean } }

// Connection events
{ type: 'deviceConnected', payload: { deviceId: string; mode: DeviceMode } }
{ type: 'deviceDisconnected', payload: { deviceId: string } }
```

## Environment Configuration

### Required Environment Variables

```bash
# Azure SignalR Service
AZURE_SIGNALR_CONNECTION_STRING="Endpoint=https://...;AccessKey=...;Version=1.0;"
AZURE_SIGNALR_HUB_NAME="realtimeticket"

# JWT Authentication
JWT_SECRET="your-jwt-secret-key"

# SignalR Routing (Azure Functions)
SIGNALR_PREFIXES="/api/negotiate,/api/signalr"
```

### Azure SignalR Service Configuration

**Service Mode**: `Serverless`
**Hub Name**: `realtimeticket`  
**Authentication**: User-based (userId from JWT)
**Messaging Pattern**: User-to-user via userId

## iPad Client Architecture

### Required Components

#### 1. SignalRService.swift

**Core Responsibilities**:
- Manage SignalR connection lifecycle
- Handle authentication with backend
- Send/receive real-time messages
- Maintain connection state

**Required Methods**:
```swift
protocol SignalRServiceProtocol {
    var delegate: SignalRServiceDelegate? { get set }
    var isConnected: Bool { get }
    
    func connect()
    func disconnect()
    func reconnect()
    
    // Message sending
    func sendMessage<T: Codable>(_ message: T) async throws
    func sendPong(payload: PongPayload?) async throws
    func sendDelivered(sessionId: String) async throws
    func sendLease(deviceId: String) async throws
    func sendStatus() async throws
    func sendFeedbackUpdate(payload: Any?) async throws
    func sendFeedbackCancelled(sessionId: String) async throws
}
```

#### 2. GatewayCenter.swift  

**Core Responsibilities**:
- Act as message router between SignalR service and app components
- Handle business logic for incoming messages
- Coordinate with ViewModels and other services

**Required Methods**:
```swift
protocol GatewayCenterProtocol: SignalRServiceDelegate {
    // Message handlers
    func handleShowFeedback(_ payload: FeedbackShowPayload)
    func handleDismiss()
    func handlePing(_ payload: PingPayload?)
    func handleLockAssigned(_ payload: Any)
    func handleModeChanged(_ payload: ModeChangedPayload)
    func handleUnpaired()
    
    // Connection events  
    func handleConnectionEstablished()
    func handleConnectionLost()
    func handleReconnection()
}
```

### Authentication Flow for iPad

```swift
// 1. Get App JWT from API key
let jwtResponse = try await apiClient.generateDeviceJWT()
try authProvider.storeAppJwt(jwtResponse.appJwt)

// 2. Use App JWT to get SignalR connection info
let connectionInfo = try await apiClient.getSignalRConnectionInfo()

// 3. Connect to SignalR with access token
signalRService.connect(url: connectionInfo.url, accessToken: connectionInfo.accessToken)
```

## Implementation Examples

### Backend: Sending Message to Device

```typescript
import { SignalRGateway } from '../signalr';

// Show feedback on specific device
await SignalRGateway.showFeedback(deviceId, {
  sessionId: "session-123",
  caseId: "case-456", 
  staff: { id: "staff-789", name: "John Doe" },
  expireAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
});

// Dismiss device
await SignalRGateway.dismissDevice(deviceId);

// Change device mode
await SignalRGateway.changeModeDevice(deviceId, 'FEEDBACK');
```

### Backend: Notifying Dashboard

```typescript
// Notify all dashboard users about case update
await SignalRGateway.notifyDashboard({
  type: 'caseUpdated',
  payload: { id: caseId, status: 'completed' }
});

// Notify about device status change
await SignalRGateway.notifyDashboard({
  type: 'deviceUpdated', 
  payload: { id: deviceId, isBusy: false, isOnline: true }
});
```

### iPad: Handling Incoming Messages

```swift
extension GatewayCenter: SignalRServiceDelegate {
    func signalRService(_ service: SignalRService, didReceiveMessage message: [String: Any]) {
        guard let type = message["type"] as? String else { return }
        
        switch type {
        case "SHOW_FEEDBACK":
            if let payload = message["payload"] as? [String: Any] {
                handleShowFeedback(FeedbackShowPayload(from: payload))
            }
            
        case "DISMISS":
            handleDismiss()
            
        case "PING":
            let payload = message["payload"] as? [String: Any]
            handlePing(PingPayload(from: payload))
            
        case "MODE_CHANGED":
            if let payload = message["payload"] as? [String: Any] {
                handleModeChanged(ModeChangedPayload(from: payload))
            }
            
        case "UNPAIRED":
            handleUnpaired()
            
        default:
            print("Unknown message type: \(type)")
        }
    }
}
```

### iPad: Sending Messages to Backend

```swift
// Send pong response
try await signalRService.sendPong(payload: PongPayload(now: ISO8601DateFormatter().string(from: Date())))

// Send delivery confirmation
try await signalRService.sendDelivered(sessionId: feedbackSession.sessionId)

// Send feedback update
try await signalRService.sendFeedbackUpdate(payload: feedbackData)

// Send cancellation
try await signalRService.sendFeedbackCancelled(sessionId: sessionId)
```

## Error Handling and Reconnection

### Backend Considerations

- **Serverless Environment**: No persistent state, messages are fire-and-forget
- **Connection Tracking**: Use database or external service to track device states
- **Message Delivery**: No delivery guarantees in serverless mode
- **Retry Logic**: Implement in client for critical operations

### iPad Client Strategies

```swift
class SignalRService {
    private var reconnectionAttempts = 0
    private let maxReconnectionAttempts = 5
    private var reconnectionTimer: Timer?
    
    func handleConnectionLost() {
        guard reconnectionAttempts < maxReconnectionAttempts else {
            delegate?.signalRServiceMaxReconnectionAttemptsReached(self)
            return
        }
        
        reconnectionAttempts += 1
        let delay = min(pow(2.0, Double(reconnectionAttempts)), 30.0) // Exponential backoff, max 30s
        
        reconnectionTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { _ in
            self.reconnect()
        }
    }
    
    func reconnect() {
        // Refresh App JWT if needed
        Task {
            await refreshAppJWTIfNeeded()
            
            // Get new SignalR connection info
            let connectionInfo = try await apiClient.getSignalRConnectionInfo()
            
            // Attempt reconnection
            connect(url: connectionInfo.url, accessToken: connectionInfo.accessToken)
        }
    }
}
```

## Security Considerations

### Token Management

1. **App JWT**: Short-lived (1 hour), refresh as needed
2. **SignalR Access Token**: Generated per connection, expires automatically
3. **API Keys**: Long-lived, stored securely on device

### Message Validation

- All incoming messages should be validated against expected schemas
- Implement rate limiting on backend for message sending
- Sanitize and validate all payload data

### Connection Security

- Use WSS (WebSocket Secure) for all SignalR connections
- Validate JWT tokens on every negotiate request
- Implement connection limits per device/user

## Monitoring and Debugging

### Logging Best Practices

**Backend**:
```typescript
context.log('🚀 [SignalR] Message sent to device:', { deviceId, messageType: message.type });
context.log('⚠️ [SignalR] Connection failed for device:', { deviceId, error: error.message });
```

**iPad**:
```swift
print("📱 [SignalR] Connected to hub: \(hubName)")
print("📱 [SignalR] Received message: \(messageType) for device: \(deviceId)")
print("⚠️ [SignalR] Connection error: \(error.localizedDescription)")
```

### Health Checks

- Implement periodic ping/pong to verify connection health
- Monitor connection metrics in Azure SignalR Service
- Track message delivery rates and failed connections

## Deployment Configuration

### Azure SignalR Service Settings

```json
{
  "serviceMode": "Serverless",
  "allowedOrigins": ["*"],
  "cors": {
    "allowCredentials": true,
    "allowedHeaders": ["*"],
    "allowedMethods": ["GET", "POST"],
    "allowedOrigins": ["*"]
  },
  "upstream": {
    "urlTemplate": "https://your-function-app.azurewebsites.net/api/{event}",
    "hubPattern": "*",
    "eventPattern": "*",
    "categoryPattern": "*"
  }
}
```

### Azure Functions Configuration

```json
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[3.15.0, 4.0.0)"
  },
  "host": {
    "http": {
      "routePrefix": "api"
    }
  }
}
```

This documentation provides a complete guide for implementing SignalR service and gateway center for bidirectional communication between iPad devices and your serverless backend.