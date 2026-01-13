# KioskApp - iPad Client

Native iOS application for iPad devices that serves as the student-facing interface for the Real-Time Ticketing System.

## Overview

The KioskApp is a SwiftUI-based iPad application that allows students to:
- **Submit help requests** for technical support
- **Provide feedback** on resolved cases
- **Real-time communication** with the backend via WebSocket

## Architecture

### **Core Components**
```
KioskApp/
├── App/                    # Application entry point
├── Core/                   # Shared infrastructure
│   ├── Models/            # Data models and stores
│   └── Services/          # API clients and networking
├── Features/              # Feature-specific modules
│   ├── Pairing/          # Device pairing with QR codes
│   ├── Registration/     # Help request submission
│   ├── Feedback/         # Feedback collection
│   └── Root/             # Navigation and routing
├── SharedUI/             # Reusable UI components
└── Resources/            # Configuration files
```

### **Key Services**
- **`ApiClient`** - HTTP API communication with backend
- **`SocketService`** - WebSocket real-time messaging
- **`PairAPI`** - Device pairing and authentication
- **`CasesAPI`** - Help request submission
- **`FeedbackAPI`** - Feedback submission
- **`GatewayCenter`** - Message routing and state management

## Features

### **1. Device Pairing**
- QR code scanning for secure device registration
- Device authentication with backend
- Mode selection (DUAL or FEEDBACK_ONLY)

### **2. Help Request Registration**
- Student information collection (name, student ID, email)
- Issue description and category selection
- Real-time submission to ticketing queue

### **3. Feedback Collection**
- Staff-initiated feedback requests
- Rating and comment submission
- Automatic session management

### **4. Real-time Communication**
- WebSocket connection with automatic reconnection
- Live status updates from dashboard
- Background message handling


### **Requirements**
- Xcode 15.0+
- iOS 16.0+
- iPad device or simulator

### **Configuration**
Environment-specific configurations in `Resources/Config/`:
- **`Debug-Local.xcconfig`** - Local development
- **`Debug-Staging.xcconfig`** - Staging environment  
- **`Release-Prod.xcconfig`** - Production deployment

### **Build & Run**
```bash
# Open in Xcode
open KioskApp.xcodeproj

# Or use command line
xcodebuild -project KioskApp.xcodeproj -scheme KioskApp -destination 'platform=iOS Simulator,name=iPad Pro (12.9-inch)'
```

## Backend Integration

### **API Endpoints**
- **`POST /pair/complete`** - Complete device pairing
- **`POST /cases`** - Submit help requests
- **`POST /feedback/submit`** - Submit feedback
- **`POST /device/heartbeat`** - Health monitoring

### **WebSocket Events**
- **`FEEDBACK_REQUEST`** - Receive feedback requests
- **`PING/PONG`** - Connection health checks
- **`DELIVERED`** - Confirm message delivery
- **`FEEDBACK_SUBMITTED`** - Send feedback data

## Device Modes

### **DUAL Mode**
- Help request registration 
- Feedback collection 
- Full feature access

### **FEEDBACK_ONLY Mode**
- Help request registration 
- Feedback collection 
- Limited to feedback functionality

## Security

### **Authentication**
- Device-specific secrets stored in Keychain
- JWT tokens for WebSocket authentication
- Secure API communication with backend

### **Data Protection**
- Local storage encryption via Keychain Services
- No persistent user data storage
- Automatic session cleanup

## Deployment

### **Device Configuration**
1. Install app on iPad devices
2. Configure backend endpoint URLs
3. Enable guided access mode for kiosk operation
4. Pair devices through staff dashboard

### **Production Considerations**
- **Guided Access** - Lock device to app only
- **Auto-lock Disabled** - Keep screen always on
- **Network Reliability** - Ensure stable WiFi connection
- **Device Management** - Use MDM for fleet deployment

## Testing

### **Unit Tests**
```bash
xcodebuild test -project KioskApp.xcodeproj -scheme KioskApp -destination 'platform=iOS Simulator,name=iPad Pro (12.9-inch)'
```

### **UI Tests**
- Automated UI testing for critical flows
- Pairing process validation
- Form submission testing

## Development Notes

### **SwiftUI Architecture**
- **MVVM Pattern** - Clear separation of concerns
- **Dependency Injection** - via AppEnvironment
- **Reactive UI** - using `@StateObject` and `@ObservedObject`

### **Network Handling**
- Automatic retry logic for failed requests
- Offline state detection and handling
- WebSocket reconnection with exponential backoff

### **Performance**
- Optimized for iPad screen sizes
- Smooth animations and transitions
- Efficient memory management

---