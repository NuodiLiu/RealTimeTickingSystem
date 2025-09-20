// Example: How to update ViewModels to use SignalR instead of WebSocket
// This shows the migration pattern for existing view models

import Foundation
import Combine

class ExampleViewModel: ObservableObject {
    private let environment: AppEnvironment
    private var cancellables = Set<AnyCancellable>()
    
    @Published var isConnected = false
    @Published var feedbackRequest: FeedbackShowPayload?
    
    init(environment: AppEnvironment) {
        self.environment = environment
        setupConnections()
    }
    
    private func setupConnections() {
        // OLD WebSocket approach:
        // environment.socketService.delegate = someDelegate
        // environment.socketService.connect()
        
        // NEW SignalR approach:
        environment.signalRService.delegate = environment.gatewayCenter
        
        // Subscribe to GatewayCenter updates (works for both WebSocket and SignalR)
        environment.gatewayCenter.$isConnected
            .assign(to: \.isConnected, on: self)
            .store(in: &cancellables)
        
        environment.gatewayCenter.$showFeedback
            .assign(to: \.feedbackRequest, on: self)
            .store(in: &cancellables)
    }
    
    // Connection management
    func connect() {
        // Try SignalR first, fallback to WebSocket if needed
        if environment.authProvider.signalRToken != nil {
            print("Using SignalR connection")
            environment.signalRService.connect()
        } else if environment.authProvider.wsToken != nil {
            print("Falling back to WebSocket connection")
            environment.socketService.connect()
        } else {
            print("No connection tokens available")
        }
    }
    
    func disconnect() {
        environment.signalRService.disconnect()
        environment.socketService.disconnect()
    }
    
    // Sending messages (works with both services)
    func sendDeliveredMessage(sessionId: String) {
        if environment.signalRService.isConnected {
            environment.signalRService.sendDelivered(sessionId: sessionId)
        } else if environment.socketService.isConnected {
            environment.socketService.sendDelivered(sessionId: sessionId)
        }
    }
    
    func sendFeedbackCancelled(sessionId: String) {
        if environment.signalRService.isConnected {
            environment.signalRService.sendFeedbackCancelled(sessionId: sessionId)
        } else if environment.socketService.isConnected {
            environment.socketService.sendFeedbackCancelled(sessionId: sessionId)
        }
    }
    
    func sendHeartbeat() {
        if environment.signalRService.isConnected {
            environment.signalRService.sendStatusPing()
        } else if environment.socketService.isConnected {
            environment.socketService.sendStatusPing()
        }
    }
}

// MARK: - Migration Strategy for Existing ViewModels

extension ExampleViewModel {
    
    /// Phase 1: Dual Connection Support
    /// Run both WebSocket and SignalR in parallel for testing
    func enableDualConnection() {
        // Connect both services
        environment.socketService.connect()
        environment.signalRService.connect()
        
        // Set both as delegates (GatewayCenter handles both)
        environment.socketService.delegate = environment.gatewayCenter
        environment.signalRService.delegate = environment.gatewayCenter
        
        // Monitor both connections
        print("WebSocket connected: \(environment.socketService.isConnected)")
        print("SignalR connected: \(environment.signalRService.isConnected)")
    }
    
    /// Phase 2: SignalR Primary with WebSocket Fallback
    func enableSignalRPrimary() {
        if environment.authProvider.signalRToken != nil {
            // Try SignalR first
            environment.signalRService.connect()
            
            // If SignalR fails after some time, fallback to WebSocket
            DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                if !self.environment.signalRService.isConnected {
                    print("SignalR failed, falling back to WebSocket")
                    self.environment.socketService.connect()
                }
            }
        } else {
            // No SignalR token, use WebSocket
            environment.socketService.connect()
        }
    }
    
    /// Phase 3: SignalR Only
    func enableSignalROnly() {
        // Only use SignalR, no fallback
        environment.signalRService.connect()
    }
}

// MARK: - Feature-Specific Examples

extension ExampleViewModel {
    
    /// Example: Pairing flow with SignalR
    func performDevicePairing() async {
        do {
            // Get device credentials from pairing API
            let credentials = try await environment.pairAPI.completePairing(/* parameters */)
            
            // Store credentials (including any SignalR tokens)
            try environment.authProvider.storeDevice(credentials: credentials)
            
            // Connect using SignalR
            environment.signalRService.connect()
            
        } catch {
            print("Pairing failed: \(error)")
        }
    }
    
    /// Example: Feedback submission with SignalR
    func submitFeedback(rating: Int, comment: String, sessionId: String) async {
        do {
            // Submit feedback via API
            try await environment.feedbackAPI.submitFeedback(
                rating: rating,
                comment: comment,
                sessionId: sessionId
            )
            
            // Notify via SignalR that feedback was submitted
            if environment.signalRService.isConnected {
                environment.signalRService.sendDelivered(sessionId: sessionId)
            }
            
        } catch {
            print("Feedback submission failed: \(error)")
            
            // Send cancellation via SignalR
            if environment.signalRService.isConnected {
                environment.signalRService.sendFeedbackCancelled(sessionId: sessionId)
            }
        }
    }
    
    /// Example: Handling device mode changes via SignalR
    func handleModeChange(_ newMode: DeviceMode) {
        print("Device mode changed to: \(newMode)")
        
        // Update local mode store
        environment.modeStore.currentMode = newMode
        
        // Reconnect if needed with new mode
        if environment.signalRService.isConnected {
            environment.signalRService.disconnect()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self.environment.signalRService.connect()
            }
        }
    }
}

// MARK: - Error Handling Examples

extension ExampleViewModel {
    
    func handleConnectionErrors() {
        // Monitor connection status and handle errors
        environment.gatewayCenter.$isConnected
            .sink { [weak self] isConnected in
                if !isConnected {
                    // Handle disconnection
                    print("Connection lost, attempting reconnection...")
                    self?.attemptReconnection()
                }
            }
            .store(in: &cancellables)
    }
    
    private func attemptReconnection() {
        // Try SignalR first, then WebSocket
        if environment.authProvider.signalRToken != nil {
            environment.signalRService.reconnect()
        } else if environment.authProvider.wsToken != nil {
            environment.socketService.reconnect()
        }
    }
}

// MARK: - Testing Helpers

#if DEBUG
extension ExampleViewModel {
    
    /// Test SignalR functionality
    func testSignalRConnection() {
        print("Testing SignalR connection...")
        
        environment.signalRService.connect()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if self.environment.signalRService.isConnected {
                print("✅ SignalR connection successful")
                
                // Test sending a message
                self.environment.signalRService.sendStatusPing()
                print("✅ Status ping sent via SignalR")
                
            } else {
                print("❌ SignalR connection failed")
            }
        }
    }
    
    /// Compare WebSocket vs SignalR performance
    func compareConnections() {
        let startTime = Date()
        
        // Test WebSocket
        environment.socketService.connect()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            let wsTime = Date().timeIntervalSince(startTime)
            print("WebSocket connection time: \(wsTime)s")
            
            // Test SignalR
            let signalRStartTime = Date()
            self.environment.signalRService.connect()
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                let signalRTime = Date().timeIntervalSince(signalRStartTime)
                print("SignalR connection time: \(signalRTime)s")
                
                print("Connection comparison complete")
            }
        }
    }
}
#endif
