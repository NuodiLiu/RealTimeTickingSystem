# SignalR Infrastructure

This module provides a SignalR-based real-time communication infrastructure as a replacement for the websocket system, using Azure Web PubSub service.

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
          │     Azure Web PubSub Service        │
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
# Azure Web PubSub Configuration
AZURE_WEB_PUBSUB_CONNECTION_STRING="Endpoint=https://your-service.webpubsub.azure.com;AccessKey=your-access-key;Version=1.0;"
AZURE_WEB_PUBSUB_HUB_NAME="ticketing-hub"

# JWT Secret (already exists)
JWT_SECRET="your-jwt-secret-key"
```

### 2. Install Dependencies

The required dependencies are already installed:
- `@azure/web-pubsub`
- `@microsoft/signalr`
- `jsonwebtoken`

### 3. Azure Web PubSub Service Setup

1. Create an Azure Web PubSub service in Azure portal
2. Get the connection string from the service
3. Configure the webhook endpoint: `https://your-domain.com/api/signalr/webhook`
4. Set the hub name to `ticketing-hub`

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

- `GET /api/signalr/device/connect` - Get device connection URL and token
- `GET /api/signalr/dashboard/connect` - Get dashboard connection URL and token

### Webhook Endpoints

- `POST /api/signalr/webhook` - Azure Web PubSub webhook handler
- `GET /api/signalr/webhook/health` - Webhook health check

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
3. Device uses token to connect to Azure Web PubSub
4. Backend handles connection events via webhooks

### Dashboard Authentication

1. User authenticates with backend (Azure AD)
2. Backend generates SignalR JWT token with user info  
3. Dashboard connects to Azure Web PubSub with token
4. Backend handles connection events via webhooks

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
3. **Update configuration**: Add Azure Web PubSub environment variables
4. **Test functionality**: All existing methods have the same signature

The SignalR infrastructure maintains full backward compatibility with the websocket interface while providing the benefits of Azure Web PubSub's managed service.

## Development

### Local Testing

For local development, you can:
1. Use Azure Web PubSub's development tier (free)
2. Set up ngrok to expose your webhook endpoint
3. Configure the webhook URL in Azure portal

### Testing Without Azure

The infrastructure gracefully handles missing configuration and will log errors but not crash the application, allowing development to continue with mock responses.
