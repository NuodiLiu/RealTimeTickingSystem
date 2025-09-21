// Core/Services/SignalRService.swift
import Foundation
import UIKit
import SignalRClient

// MARK: - DeviceGatewayDelegate Protocol
protocol DeviceGatewayDelegate: AnyObject {
    func gatewayDidConnect()
    func gatewayDidDisconnect()
    func gatewayShowFeedback(_ payload: FeedbackShowPayload, raw: [String: Any])
    func gatewayDismiss()
    func gatewayLockAssigned(_ payload: LockAssignedPayload, raw: [String: Any])
    func gatewayModeChanged(_ mode: DeviceMode)
    func gatewayDeviceUnpaired()
}

extension DeviceGatewayDelegate {
    func gatewayModeChanged(_ mode: DeviceMode) {}
    func gatewayDeviceUnpaired() {}
}

// MARK: - Data Models
struct FeedbackShowPayload: Decodable { 
    let sessionId: String
    let caseId: String
    let staff: StaffInfo
    let expireAt: String
}

struct StaffInfo: Decodable {
    let id: String
    let name: String
}

struct LockAssignedPayload: Decodable { 
    let lockId: String?
    let caseId: String?
    let staffName: String?
    let leaseExpireAt: String? 
}

// MARK: - SignalR Connection State Enum
enum SignalRConnectionState {
    case disconnected
    case connecting
    case connected
    case reconnecting
}

// MARK: - SignalR Service
final class SignalRService {
    private var hubConnection: HubConnection?
    private let apiBaseURL: URL
    private let authProvider: AuthProviding
    private let apiClient: ApiClient
    private var isIntentionallyDisconnected = false
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    
    weak var delegate: DeviceGatewayDelegate?
    
    init(apiBaseURL: URL, authProvider: AuthProviding, apiClient: ApiClient) {
        self.apiBaseURL = apiBaseURL
        self.authProvider = authProvider
        self.apiClient = apiClient
        setupApplicationLifecycleNotifications()
    }
    
    deinit {
        removeApplicationLifecycleNotifications()
        endBackgroundTask()
    }
    
    // MARK: - Application Lifecycle Management
    
    private func setupApplicationLifecycleNotifications() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applicationWillTerminate),
            name: UIApplication.willTerminateNotification,
            object: nil
        )
        
        // Add ping notification observer
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handlePingNotification(_:)),
            name: NSNotification.Name("SignalRPingReceived"),
            object: nil
        )
    }
    
    private func removeApplicationLifecycleNotifications() {
        NotificationCenter.default.removeObserver(self)
    }
    
    @objc private func applicationWillEnterForeground() {
        print("📱 SignalRService: App entering foreground, checking connection...")
        endBackgroundTask()
        
        if authProvider.appJwt != nil && authProvider.deviceId != nil && !isIntentionallyDisconnected {
            if !isConnected {
                print("SignalRService: Auto-reconnecting on foreground...")
                connect()
            }
        }
    }
    
    @objc private func applicationDidEnterBackground() {
        print("SignalRService: App entering background, starting background task...")
        
        backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
            print("📱 SignalRService: Background task expired")
            self?.endBackgroundTask()
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.endBackgroundTask()
        }
    }
    
    @objc private func applicationWillTerminate() {
        print("SignalRService: App will terminate, disconnecting...")
        disconnect()
    }
    
    @objc private func handlePingNotification(_ notification: Notification) {
        print("SignalRService: Handling ping notification")
        let payload = notification.userInfo as? [String: Any] ?? [:]
        Task {
            await invokePong(payload: payload)
        }
    }
    
    private func endBackgroundTask() {
        if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
    }
    
    // MARK: - Connection Management
    
    func connect() {
        Task {
            await performConnect()
        }
    }
    
    @MainActor
    private func performConnect() async {
        guard let deviceId = authProvider.deviceId else {
            print("SignalRService.connect() skipped: no device ID available")
            return
        }
        
        guard authProvider.appJwt != nil else {
            print("SignalRService.connect() skipped: no App JWT available")
            return
        }

        print("SignalRService.connect() starting for device: \(String(deviceId.prefix(8)))...")
        
        do {
            let isPaired = try await apiClient.checkPairingStatus(deviceId: deviceId)
            if !isPaired {
                print("SignalRService: Device is no longer paired on server, clearing credentials...")
                
                do {
                    try authProvider.clearDevice()
                } catch {
                    print("SignalRService: Failed to clear device credentials: \(error)")
                }
                delegate?.gatewayDeviceUnpaired()
                return
            }
            print("SignalRService: Device pairing status confirmed, proceeding with connection...")
        } catch {
            print("SignalRService: Failed to check pairing status: \(error)")
            print("SignalRService: Proceeding with connection anyway...")
        }
        
        isIntentionallyDisconnected = false
        
        // Get SignalR connection details from the backend
        do {
            let connectionInfo = try await getNegotiateInfo()
            
            // Disconnect existing connection
            if let existingConnection = hubConnection {
                await existingConnection.stop()
                hubConnection = nil
            }
            
            // Create new connection using official SignalR client
            let urlWithToken = connectionInfo.url + (connectionInfo.url.contains("?") ? "&" : "?") +
                              "access_token=" + (connectionInfo.accessToken.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")
            
            hubConnection = HubConnectionBuilder()
                .withUrl(url: urlWithToken, transport: .webSockets)
                .withAutomaticReconnect() // Enable automatic reconnection
                .build()
            
            setupSignalRHandlers()
            
            // Start connection
            try await hubConnection?.start()
            print("SignalRService: Connected successfully!")
            delegate?.gatewayDidConnect()
            
        } catch {
            print("SignalRService: Failed to connect: \(error)")
            delegate?.gatewayDidDisconnect()
        }
    }
    
    func disconnect() {
        print("SignalRService: Manual disconnect requested")
        isIntentionallyDisconnected = true
        Task {
            await hubConnection?.stop()
            hubConnection = nil
        }
        endBackgroundTask()
        delegate?.gatewayDidDisconnect()
    }
    
    func reconnect() {
        print("SignalRService: Manual reconnect requested")
        if authProvider.appJwt != nil && authProvider.deviceId != nil {
            connect()
        } else {
            print("SignalRService: Cannot reconnect - no App JWT or device ID")
        }
    }
    
    var isConnected: Bool {
        hubConnection != nil
    }
    
    // MARK: - SignalR Hub Methods Setup
    
    private func setupSignalRHandlers() {
        guard let connection = hubConnection else { return }
        
        // Store delegate reference to avoid capturing self
        let delegate = self.delegate
        
        // Server to Device methods (following the backend SignalR implementation)
        
        Task {
            await connection.on("showFeedback") { @Sendable (arguments: [Any]) in
                guard let payload = arguments.first as? [String: Any] else { return }
                
                print("SignalRService: *** showFeedback received ***")
                print("SignalRService: Payload: \(payload)")
                
                if let decoded: FeedbackShowPayload = SignalRService.decode(payload) {
                    print("SignalRService: Successfully decoded showFeedback, calling delegate")
                    Task { @MainActor in
                        delegate?.gatewayShowFeedback(decoded, raw: payload)
                    }
                } else {
                    print("SignalRService: Failed to decode showFeedback payload")
                }
            }
            
            await connection.on("dismiss") { @Sendable (_: [Any]) in
                print("SignalRService: dismiss received")
                Task { @MainActor in
                    delegate?.gatewayDismiss()
                }
            }
            
            await connection.on("ping") { @Sendable (arguments: [Any]) in
                print("SignalRService: ping received")
                // Respond with pong - handle this via notification or different mechanism
                let payload = arguments.first as? [String: Any] ?? [:]
                NotificationCenter.default.post(
                    name: NSNotification.Name("SignalRPingReceived"), 
                    object: nil, 
                    userInfo: payload
                )
            }
            
            await connection.on("lockAssigned") { @Sendable (arguments: [Any]) in
                guard let payload = arguments.first as? [String: Any] else { return }
                
                print("SignalRService: lockAssigned received")
                if let decoded: LockAssignedPayload = SignalRService.decode(payload) {
                    Task { @MainActor in
                        delegate?.gatewayLockAssigned(decoded, raw: payload)
                    }
                }
            }
            
            await connection.on("modeChanged") { @Sendable (arguments: [Any]) in
                guard let payload = arguments.first as? [String: Any],
                      let modeString = payload["mode"] as? String,
                      let mode = DeviceMode(rawValue: modeString) else { return }
                
                print("SignalRService: modeChanged received: \(mode)")
                Task { @MainActor in
                    delegate?.gatewayModeChanged(mode)
                }
            }
            
            await connection.on("unpaired") { @Sendable (_: [Any]) in
                print("SignalRService: unpaired received from server")
                Task { @MainActor in
                    delegate?.gatewayDeviceUnpaired()
                }
            }
        }
        
        // Note: Connection lifecycle events might need to be handled differently
        // based on the actual SignalR Swift client API
    }
    
    // MARK: - Device to Server Hub Methods
    
    func invokePong(payload: [String: Any] = [:]) async {
        do {
            try await hubConnection?.invoke(method: "pong", arguments: [payload])
        } catch {
            print("SignalRService: Failed to send pong: \(error)")
        }
    }
    
    func invokeDelivered(sessionId: String) {
        let payload = ["sessionId": sessionId]
        Task {
            do {
                try await hubConnection?.invoke(method: "delivered", arguments: [payload])
            } catch {
                print("SignalRService: Failed to send delivered: \(error)")
            }
        }
    }
    
    func invokeFeedbackCancelled(sessionId: String) {
        let payload = ["sessionId": sessionId]
        Task {
            do {
                try await hubConnection?.invoke(method: "feedbackCancelled", arguments: [payload])
            } catch {
                print("SignalRService: Failed to send feedbackCancelled: \(error)")
            }
        }
    }
    
    func invokeLease() {
        guard let deviceId = authProvider.deviceId else { return }
        let payload = ["deviceId": deviceId]
        Task {
            do {
                try await hubConnection?.invoke(method: "lease", arguments: [payload])
            } catch {
                print("SignalRService: Failed to send lease: \(error)")
            }
        }
    }
    
    func invokeStatus() {
        Task {
            do {
                try await hubConnection?.invoke(method: "status", arguments: [])
            } catch {
                print("SignalRService: Failed to send status: \(error)")
            }
        }
    }
    
    // MARK: - Helper Methods
    
    private func getNegotiateInfo() async throws -> NegotiateInfo {
        // Use the existing ApiClient method to get connection info
        let response = try await apiClient.getSignalRConnectionInfo()
        
        // Store the SignalR token and endpoint
        try authProvider.storeSignalRInfo(token: response.token, endpoint: response.url)
        
        return NegotiateInfo(
            url: response.url,
            accessToken: response.token
        )
    }
    
    static func decode<T: Decodable>(_ dict: [String: Any]) -> T? {
        guard JSONSerialization.isValidJSONObject(dict),
              let data = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
}

// MARK: - Legacy Methods for Compatibility

extension SignalRService {
    // These methods maintain compatibility with the existing SocketService interface
    
    func sendDelivered(sessionId: String) {
        invokeDelivered(sessionId: sessionId)
    }
    
    func sendFeedbackCancelled(sessionId: String) {
        invokeFeedbackCancelled(sessionId: sessionId)
    }
    
    func sendLeaseTick() {
        invokeLease()
    }
    
    func sendStatusPing() {
        invokeStatus()
    }
}

// MARK: - Connection Info Models

struct NegotiateInfo {
    let url: String
    let accessToken: String
}
