# iOS Project Dependency Updates for SignalR Migration

## Overview
This document outlines the steps to update the KioskApp iOS project dependencies to replace Socket.IO with Azure SignalR support.

## Current Dependencies to Remove
- **Socket.IO-Client-Swift** - Remove this dependency as we're replacing WebSocket with SignalR

## New Dependencies to Add

### Option 1: Using Microsoft SignalR SDK (Recommended)
Add the official Microsoft SignalR client for iOS:

```swift
// In Xcode Package Manager, add:
https://github.com/Azure/azure-signalr-service-bindings-for-swift
```

### Option 2: Using Azure Communication Services (Alternative)
If you prefer Azure Communication Services SignalR:

```swift
// In Xcode Package Manager, add:
https://github.com/Azure/azure-sdk-for-ios
```

### Option 3: Custom Implementation (Current)
The current `SignalRService.swift` uses a custom WebSocket implementation that works with Azure SignalR Service. This requires no additional dependencies but is a simplified implementation.

## Steps to Update Dependencies

### 1. Remove Socket.IO Dependency
1. Open `KioskApp.xcodeproj` in Xcode
2. Go to the project navigator and select the project
3. Select the "KioskApp" target
4. Go to "Package Dependencies" tab
5. Find "SocketIO" and remove it
6. Clean build folder (`Product > Clean Build Folder`)

### 2. Add Azure SignalR Dependencies (Choose Option 1 or 2)

#### For Option 1 (Microsoft SignalR):
1. Go to `File > Add Package Dependencies`
2. Enter URL: `https://github.com/Azure/azure-signalr-service-bindings-for-swift`
3. Select version and add to target

#### For Option 2 (Azure Communication Services):
1. Go to `File > Add Package Dependencies`
2. Enter URL: `https://github.com/Azure/azure-sdk-for-ios`
3. Select the `AzureCommunicationCommon` and `AzureCommunicationChat` products
4. Add to target

### 3. Update Import Statements

Replace SocketIO imports with SignalR imports:

```swift
// Remove this:
import SocketIO

// Add this (for Option 1):
import AzureSignalR

// Or this (for Option 2):
import AzureCommunicationCommon
```

### 4. Update the SignalRService Implementation

If using Option 1 or 2, replace the custom `SignalRHubConnection` implementation in `SignalRService.swift` with the official SDK:

```swift
// Example for Microsoft SignalR SDK:
import AzureSignalR

class SignalRService {
    private var hubConnection: HubConnection?
    
    func connect() {
        let hubConnectionBuilder = HubConnectionBuilder(url: connectionUrl)
        hubConnection = hubConnectionBuilder.build()
        
        hubConnection?.start { [weak self] error in
            if let error = error {
                print("SignalR connection failed: \(error)")
            } else {
                print("SignalR connected successfully")
                self?.setupSignalRHandlers()
            }
        }
    }
}
```

## Migration Strategy

### Phase 1: Parallel Operation
- Keep both `SocketService` and `SignalRService` running in parallel
- Test SignalR functionality while keeping WebSocket as fallback
- Update `GatewayCenter` to handle both connection types

### Phase 2: SignalR Primary
- Switch to using SignalR as the primary connection method
- Keep WebSocket as fallback for compatibility

### Phase 3: Full Migration
- Remove WebSocket/Socket.IO dependencies entirely
- Remove `SocketService.swift`
- Clean up unused WebSocket-related code

## Testing

### 1. Connection Testing
```swift
// Test SignalR connection
let signalRService = AppEnvironment.shared.signalRService
signalRService.connect()

// Verify connection status
print("SignalR Connected: \(signalRService.isConnected)")
```

### 2. Message Testing
```swift
// Test sending messages
signalRService.invokeStatus()
signalRService.invokeLease()

// Test receiving messages (check delegate callbacks)
```

### 3. Lifecycle Testing
- Test app backgrounding/foregrounding
- Test network connectivity changes
- Test device pairing/unpairing scenarios

## Backend Considerations

Ensure the backend SignalR implementation is properly configured:

1. **Azure Web PubSub Configuration**
   - Verify `AZURE_WEB_PUBSUB_CONNECTION_STRING` environment variable
   - Confirm hub name configuration

2. **Authentication**
   - Ensure JWT tokens are properly generated for devices
   - Verify SignalR auth middleware is working

3. **Hub Methods**
   - Confirm all hub methods are implemented on the backend
   - Test message broadcasting to devices

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check Azure Web PubSub connection string
   - Verify JWT token format and expiration
   - Ensure network connectivity

2. **Message Delivery Issues**
   - Verify hub method names match between client and server
   - Check message serialization/deserialization
   - Confirm group memberships for targeted messages

3. **Authentication Errors**
   - Verify device API key is valid
   - Check JWT token generation on backend
   - Ensure proper Authorization header format

### Debug Logging

Enable detailed logging in SignalRService:

```swift
print("SignalR: Connection attempt to \(connectionUrl)")
print("SignalR: Token: \(token.prefix(20))...")
print("SignalR: Hub method invoked: \(method)")
```

## Performance Considerations

- SignalR may have different connection overhead compared to Socket.IO
- Monitor memory usage and connection stability
- Consider connection pooling for high-traffic scenarios
- Implement proper error handling and retry logic

## Security Considerations

- Ensure JWT tokens have appropriate expiration times
- Use secure connection strings (HTTPS/WSS)
- Implement proper token refresh mechanisms
- Validate all incoming messages on the client side
