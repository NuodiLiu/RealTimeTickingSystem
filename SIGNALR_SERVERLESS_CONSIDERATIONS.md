# SignalR Serverless Mode - Critical Considerations

## Overview
Your SignalR implementation is using **Azure Web PubSub in serverless mode**, which has significant differences from traditional SignalR Hub-based implementations. Here are the critical considerations and potential issues.

## ⚠️ Critical Issues Identified

### 1. **Connection Management Mismatch**
**Problem**: Your iOS app is trying to connect using the traditional SignalR Hub protocol, but Azure Web PubSub serverless mode uses a different protocol.

**Current iOS Implementation (WRONG for serverless)**:
```swift
// This won't work with Azure Web PubSub serverless
let handshake = ["protocol": "json", "version": 1]
hubConnection?.invoke(method: "pong", arguments: [payload])
```

**What Azure Web PubSub Serverless Actually Uses**:
- WebSocket with JSON messages (not SignalR Hub protocol)
- No method invocation - uses raw JSON messages
- No handshake negotiation

### 2. **Authentication Flow Issues**
**Problem**: The current auth flow generates SignalR JWT tokens, but Azure Web PubSub serverless uses access tokens.

**Current Implementation**:
```typescript
// This generates SignalR JWTs, but should generate Web PubSub access tokens
const token = jwt.sign({ deviceId, mode, type: 'device' }, secret);
```

**Should Be**:
```typescript
// Use Azure Web PubSub SDK to generate access tokens
const token = await serviceClient.getClientAccessToken({
  userId: deviceId,
  expirationTimeInMinutes: 60,
  groups: ['devices', `device-${deviceId}`]
});
```

### 3. **Message Protocol Mismatch**
**Problem**: Your backend expects SignalR Hub method calls, but Azure Web PubSub serverless receives webhook events.

**Current iOS Sends**:
```swift
// SignalR Hub method call format
{
  "type": 1,
  "target": "pong", 
  "arguments": [payload]
}
```

**Azure Web PubSub Expects**:
```json
// Simple JSON message format
{
  "type": "pong",
  "payload": { "deviceId": "dev-123" }
}
```

## 🔧 Required Fixes

### 1. Fix Backend Auth Endpoint
Update `/api/signalr/device/token` to return Web PubSub access tokens:

```typescript
export async function generateSignalRTokenFromApiKey(req: Request, res: Response) {
  try {
    const { deviceId, device } = await validateDeviceApiKey(req.headers.authorization!);
    
    // Use Azure Web PubSub SDK instead of JWT
    const accessToken = await signalRConfig.getServiceClient().getClientAccessToken({
      userId: deviceId,
      expirationTimeInMinutes: 60,
      groups: ['devices', `device-${deviceId}`],
      roles: ['webpubsub.sendToGroup.devices', 'webpubsub.joinLeaveGroup']
    });
    
    res.json({
      url: accessToken.url,
      token: accessToken.token,
      deviceId: device.id,
      mode: device.mode
    });
    
  } catch (error) {
    // handle error
  }
}
```

### 2. Update iOS SignalR Implementation
Replace the current SignalR Hub connection with a simple WebSocket:

```swift
class AzureWebPubSubConnection {
    private var webSocketTask: URLSessionWebSocketTask?
    
    func connect(accessUrl: String) {
        guard let url = URL(string: accessUrl) else { return }
        
        // Azure Web PubSub provides the full URL with access token
        webSocketTask = URLSession.shared.webSocketTask(with: url)
        webSocketTask?.resume()
        
        // No handshake needed - start listening immediately
        receiveMessage()
    }
    
    func sendMessage(type: String, payload: [String: Any] = [:]) {
        let message = [
            "type": type,
            "payload": payload
        ]
        
        if let data = try? JSONSerialization.data(withJSONObject: message),
           let jsonString = String(data: data, encoding: .utf8) {
            let wsMessage = URLSessionWebSocketTask.Message.string(jsonString)
            webSocketTask?.send(wsMessage) { _ in }
        }
    }
}
```

### 3. Configure Web PubSub Event Handler
Ensure your Azure Web PubSub service is configured with webhook endpoints:

```bash
# Configure in Azure Portal or Azure CLI
az webpubsub hub create \
  --resource-group "your-rg" \
  --name "ticketing-system" \
  --hub-name "ticketingHub" \
  --event-handler \
    url-template="https://your-domain.com/api/signalr/webhook" \
    user-event-pattern="*" \
    system-events="connect,connected,disconnected"
```

## 🏗️ Architecture Implications

### Serverless Benefits:
✅ **Automatic Scaling**: Azure handles connection scaling
✅ **No Server Management**: No need to manage SignalR Hub servers
✅ **Cost Effective**: Pay per message, not per server
✅ **Global Distribution**: Azure's global network

### Serverless Limitations:
❌ **No Persistent State**: Cannot store connection state on server
❌ **Webhook Latency**: Messages go through webhook roundtrip
❌ **Limited Real-time Features**: Some SignalR features not available
❌ **More Complex Debugging**: Harder to trace message flow

## 🔄 Message Flow in Serverless Mode

### Traditional SignalR (What you coded for):
```
iOS App → SignalR Hub → Business Logic → Response
```

### Azure Web PubSub Serverless (What you actually have):
```
iOS App → Azure Web PubSub → Webhook → Business Logic → Azure Web PubSub → iOS App
```

## 📱 iOS App Connection Pattern Fix

### Current (Broken):
```swift
// This won't work with Azure Web PubSub
hubConnection = SignalRHubConnection(url: connectionUrl, accessToken: token)
hubConnection?.start()
hubConnection?.invoke(method: "pong", arguments: [])
```

### Fixed for Serverless:
```swift
// Use the access URL directly (contains token)
let webSocket = URLSession.shared.webSocketTask(with: URL(string: accessUrl)!)
webSocket.resume()

// Send raw JSON messages
let message = ["type": "pong", "payload": ["deviceId": deviceId]]
let data = try! JSONSerialization.data(withJSONObject: message)
let messageString = String(data: data, encoding: .utf8)!
webSocket.send(.string(messageString)) { _ in }
```

## 🚨 Immediate Action Items

1. **Fix Backend Token Generation**
   - Update `/api/signalr/device/token` to use Web PubSub access tokens
   - Remove SignalR JWT generation

2. **Update iOS Connection Logic**
   - Remove SignalR Hub protocol implementation
   - Use simple WebSocket with JSON messages
   - Update message sending format

3. **Configure Azure Web PubSub**
   - Set up webhook URL in Azure Portal
   - Configure event handlers for connect/disconnect/message events
   - Test webhook connectivity

4. **Update Message Handlers**
   - Modify webhook handlers to process raw JSON messages
   - Update message routing in eventHandler.ts

## 🧪 Testing Serverless Setup

### 1. Test Access Token Generation:
```bash
curl -X POST http://localhost:3000/api/signalr/device/token \
  -H "Authorization: Device {deviceId}:{deviceSecret}" \
  -H "Content-Type: application/json"
```

### 2. Test WebSocket Connection:
```javascript
// Use the access URL from token response directly
const ws = new WebSocket(accessUrl);
ws.onopen = () => console.log('Connected to Azure Web PubSub');
ws.send(JSON.stringify({type: "pong", payload: {}}));
```

### 3. Test Webhook Delivery:
```bash
# Check if webhooks are being received
curl http://localhost:3000/api/signalr/webhook/health
```

## 💡 Alternative Approach: Hybrid Mode

If serverless limitations are too restrictive, consider **Azure SignalR Service in managed mode**:

- Keeps traditional SignalR Hub functionality
- Still gets Azure's scaling benefits
- Supports all SignalR features
- Requires changing environment configuration

Would you like me to implement these fixes for the serverless mode, or would you prefer to explore the managed mode option?
