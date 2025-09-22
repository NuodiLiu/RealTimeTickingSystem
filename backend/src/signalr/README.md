# SignalR Infrastructure

This module provides a SignalR-based real-time communication infrastructure as a replacement for the websocket system, using Azure SignalR Service.

## Features

- **Device Management**: Connect and manage kiosk devices through SignalR
- **Dashboard Integration**: Real-time dashboard updates and notifications  
- **Message Broadcasting**: Send messages to individual devices or groups
- **Authentication**: JWT-based authentication for devices and dashboard users
- **Event Handling**: Comprehensive event handling for connect/disconnect/message events
- **Health Monitoring**: Connection tracking and stale connection cleanup

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Kiosk Device  │    │   Dashboard     │    │   Backend API   │
│                 │    │                 │    │                 │
│ SignalR Client  │    │ SignalR Client  │    │ SignalR Service │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────┬───────────┴──────────────────────┘
                     │
          ┌─────────────────────────────────────┐
          │     Azure SignalR Service           │
          │                                     │
          │  • Connection Management            │
          │  • Message Routing                  │
          │  • Group Management                 │
          │  • Authentication                   │
          └─────────────────────────────────────┘
```

## Setup

### 1. Environment Configuration

Add these variables to your `.env` file:

```bash
# Azure SignalR Service Configuration
AZURE_SIGNALR_CONNECTION_STRING="Endpoint=https://your-service.service.signalr.net;AccessKey=your-access-key;Version=1.0;"
AZURE_SIGNALR_HUB_NAME="realtimeticket"

# JWT Secret (already exists)
JWT_SECRET="your-jwt-secret-key"
```

### 2. Install Dependencies

The required dependencies are already installed:
- `@microsoft/signalr`
- `jsonwebtoken`

### 3. Azure SignalR Service Setup

1. Create an Azure SignalR Service in Azure portal
2. Get the connection string from the service
3. Configure upstream event handlers in the service settings
4. Set the hub name to `realtimeticket`

## Usage

### Basic Integration

```typescript
import { SignalRGateway } from './signalr';

// Send message to a specific device
const success = await SignalRGateway.sendToDevice('device-123', {
  type: 'SHOW_FEEDBACK',
  payload: feedbackData
});

// Broadcast to all devices
await SignalRGateway.broadcastToDevices({
  type: 'PING',
  payload: { now: new Date().toISOString() }
});

// Notify dashboard
await SignalRGateway.notifyDashboard({
  type: 'device:updated',
  payload: { deviceId: 'device-123', isOnline: true }
});
```

### Drop-in Replacement

The `SignalRGateway` class provides the same interface as the existing websocket `DeviceGateway`, making it a drop-in replacement:

```typescript
// Before (websocket)
import { DeviceGateway } from '../websocket';
await DeviceGateway.showFeedback(deviceId, payload);

// After (SignalR)
import { SignalRGateway } from '../signalr';
await SignalRGateway.showFeedback(deviceId, payload);
```

## API Endpoints

### Authentication Endpoints

- `GET /api/negotiate` - Get SignalR connection URL and token (for clients)

### Function Endpoints

- `POST /api/signalr/connected` - Azure SignalR Service event handler
- `POST /api/signalr/disconnected` - Azure SignalR Service event handler  
- `POST /api/signalr/message` - Azure SignalR Service event handler

## Message Types

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

## Authentication Flow

### Device Authentication

1. Device authenticates with backend using existing device credentials
2. Backend generates SignalR JWT token with device info
3. Device uses token to connect to Azure SignalR Service
4. Backend handles connection events via Azure Functions

### Dashboard Authentication

1. User authenticates with backend (Azure AD)
2. Backend generates SignalR JWT token with user info  
3. Dashboard connects to Azure SignalR Service with token
4. Backend handles connection events via Azure Functions

## Group Management

Devices are automatically added to these groups:
- `devices` - All connected devices
- `device-{deviceId}` - Individual device group
- `mode-{mode}` - Devices by mode (registration/feedback)

Dashboard connections are added to:
- `dashboard` - All dashboard connections

## Error Handling

The infrastructure includes comprehensive error handling:
- Connection failures are logged and handled gracefully
- Invalid messages are ignored with warnings
- Authentication failures return appropriate HTTP status codes
- Database errors are caught and logged

## Monitoring

### Connection Stats

```typescript
const stats = SignalRGateway.getConnectionStats();
console.log(`Devices: ${stats.devices}, Dashboard: ${stats.dashboard}`);
```

### Health Checks

```typescript
// Ping all devices
await SignalRGateway.pingAllDevices();

// Cleanup stale connections
const cleaned = SignalRGateway.cleanupStaleConnections(10); // 10 minutes timeout
```

## Migration from WebSocket

To migrate from the existing websocket system:

1. **Update imports**: Change from `../websocket` to `../signalr`
2. **Replace class name**: `DeviceGateway` → `SignalRGateway`
3. **Update configuration**: Add Azure SignalR Service environment variables
4. **Test functionality**: All existing methods have the same signature

The SignalR infrastructure maintains full backward compatibility with the websocket interface while providing the benefits of Azure SignalR Service's managed service.

## Development

### Local Testing

For local development, you can:
1. Use Azure SignalR Service's development tier (free)
2. Configure upstream event handlers to point to your local Azure Functions
3. Use ngrok if testing from external clients

### Testing Without Azure

The infrastructure gracefully handles missing configuration and will log errors but not crash the application, allowing development to continue with mock responses.
