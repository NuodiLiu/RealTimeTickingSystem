// Core/Services/SignalRService.swift
import Foundation
import UIKit

// MARK: - SignalR Connection Protocol
protocol SignalRConnectionProtocol: AnyObject {
    func start(completion: @escaping (Error?) -> Void)
    func stop()
    func invoke(method: String, arguments: [Any], completion: @escaping (Error?) -> Void)
    func on(method: String, callback: @escaping ([Any?]) -> Void)
    var connectionState: SignalRConnectionState { get }
}

// MARK: - Connection State Enum
enum SignalRConnectionState {
    case disconnected
    case connecting
    case connected
    case reconnecting
}

// MARK: - SignalR Hub Connection
/// A basic SignalR Hub Connection implementation
/// This is a simplified implementation - in production, you would use the official Microsoft SignalR iOS SDK
class SignalRHubConnection: SignalRConnectionProtocol {
    private var urlSession: URLSession?
    private var webSocketTask: URLSessionWebSocketTask?
    private var connectionUrl: String?
    private var accessToken: String?
    
    private var methodCallbacks: [String: ([Any?]) -> Void] = [:]
    private var isRunning = false
    
    var connectionState: SignalRConnectionState {
        guard isRunning else { return .disconnected }
        guard let task = webSocketTask else { return .disconnected }
        
        switch task.state {
        case .running:
            return .connected
        case .suspended:
            return .reconnecting
        default:
            return .disconnected
        }
    }
    
    init(url: String, accessToken: String) {
        self.connectionUrl = url
        self.accessToken = accessToken
        self.urlSession = URLSession(configuration: .default)
    }
    
    func start(completion: @escaping (Error?) -> Void) {
        guard let urlString = connectionUrl,
              let url = URL(string: urlString) else {
            completion(SignalRError.invalidUrl)
            return
        }
        
        var request = URLRequest(url: url)
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        webSocketTask = urlSession?.webSocketTask(with: request)
        isRunning = true
        
        webSocketTask?.resume()
        
        // Start listening for messages
        receiveMessage()
        
        // Send handshake
        let handshake = ["protocol": "json", "version": 1]
        if let data = try? JSONSerialization.data(withJSONObject: handshake),
           let handshakeString = String(data: data, encoding: .utf8) {
            let message = URLSessionWebSocketTask.Message.string(handshakeString + "\u{1e}")
            webSocketTask?.send(message) { error in
                completion(error)
            }
        }
    }
    
    func stop() {
        isRunning = false
        webSocketTask?.cancel()
        webSocketTask = nil
    }
    
    func invoke(method: String, arguments: [Any], completion: @escaping (Error?) -> Void) {
        let invocation: [String: Any] = [
            "type": 1,
            "target": method,
            "arguments": arguments
        ]
        
        guard let data = try? JSONSerialization.data(withJSONObject: invocation),
              let jsonString = String(data: data, encoding: .utf8) else {
            completion(SignalRError.serializationError)
            return
        }
        
        let message = URLSessionWebSocketTask.Message.string(jsonString + "\u{1e}")
        webSocketTask?.send(message, completionHandler: completion)
    }
    
    func on(method: String, callback: @escaping ([Any?]) -> Void) {
        methodCallbacks[method] = callback
    }
    
    private func receiveMessage() {
        guard isRunning else { return }
        
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            
            switch result {
            case .success(let message):
                self.handleMessage(message)
                self.receiveMessage() // Continue listening
            case .failure(let error):
                print("SignalR: Receive error: \(error)")
                // Attempt reconnection logic here if needed
            }
        }
    }
    
    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            // Remove the record separator
            let cleanText = text.replacingOccurrences(of: "\u{1e}", with: "")
            guard !cleanText.isEmpty,
                  let data = cleanText.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                return
            }
            
            handleJsonMessage(json)
            
        case .data(let data):
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                handleJsonMessage(json)
            }
        @unknown default:
            break
        }
    }
    
    private func handleJsonMessage(_ json: [String: Any]) {
        guard let type = json["type"] as? Int else { return }
        
        switch type {
        case 1: // Invocation
            if let target = json["target"] as? String,
               let arguments = json["arguments"] as? [Any?],
               let callback = methodCallbacks[target] {
                callback(arguments)
            }
        case 6: // Ping
            // Respond with pong
            let pong = ["type": 6]
            if let data = try? JSONSerialization.data(withJSONObject: pong),
               let pongString = String(data: data, encoding: .utf8) {
                let message = URLSessionWebSocketTask.Message.string(pongString + "\u{1e}")
                webSocketTask?.send(message) { _ in }
            }
        default:
            break
        }
    }
}

// MARK: - SignalR Errors
enum SignalRError: Error {
    case invalidUrl
    case serializationError
    case connectionFailed
    case notConnected
    
    var localizedDescription: String {
        switch self {
        case .invalidUrl:
            return "Invalid SignalR URL"
        case .serializationError:
            return "Failed to serialize SignalR message"
        case .connectionFailed:
            return "SignalR connection failed"
        case .notConnected:
            return "SignalR not connected"
        }
    }
}

// MARK: - Main SignalR Service
final class SignalRService {
    private var hubConnection: SignalRConnectionProtocol?
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
    }
    
    private func removeApplicationLifecycleNotifications() {
        NotificationCenter.default.removeObserver(self)
    }
    
    @objc private func applicationWillEnterForeground() {
        print("📱 SignalRService: App entering foreground, checking connection...")
        endBackgroundTask()
        
        if authProvider.signalRToken != nil && authProvider.deviceId != nil && !isIntentionallyDisconnected {
            if hubConnection?.connectionState != .connected {
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
            let connectionInfo = try await getSignalRConnectionInfo()
            
            // Disconnect existing connection
            hubConnection?.stop()
            
            // Create new connection
            hubConnection = SignalRHubConnection(
                url: connectionInfo.url,
                accessToken: connectionInfo.token
            )
            
            setupSignalRHandlers()
            
            // Start connection
            hubConnection?.start { [weak self] error in
                DispatchQueue.main.async {
                    if let error = error {
                        print("SignalRService: Connection failed: \(error)")
                        self?.delegate?.gatewayDidDisconnect()
                    } else {
                        print("SignalRService: Connected successfully!")
                        self?.delegate?.gatewayDidConnect()
                    }
                }
            }
            
        } catch {
            print("SignalRService: Failed to get connection info: \(error)")
            delegate?.gatewayDidDisconnect()
        }
    }
    
    func disconnect() {
        print("SignalRService: Manual disconnect requested")
        isIntentionallyDisconnected = true
        hubConnection?.stop()
        hubConnection = nil
        endBackgroundTask()
        delegate?.gatewayDidDisconnect()
    }
    
    func reconnect() {
        print("SignalRService: Manual reconnect requested")
        if authProvider.signalRToken != nil && authProvider.deviceId != nil {
            connect()
        } else {
            print("SignalRService: Cannot reconnect - no SignalR token or device ID")
        }
    }
    
    var isConnected: Bool {
        hubConnection?.connectionState == .connected
    }
    
    // MARK: - SignalR Hub Methods Setup
    
    private func setupSignalRHandlers() {
        // Server to Device methods (following the backend SignalR implementation)
        
        hubConnection?.on(method: "showFeedback") { [weak self] arguments in
            guard let self = self,
                  let payload = arguments.first as? [String: Any] else { return }
            
            print("SignalRService: *** showFeedback received ***")
            print("SignalRService: Payload: \(payload)")
            
            if let decoded: FeedbackShowPayload = Self.decode(payload) {
                print("SignalRService: Successfully decoded showFeedback, calling delegate")
                DispatchQueue.main.async {
                    self.delegate?.gatewayShowFeedback(decoded, raw: payload)
                }
            } else {
                print("SignalRService: Failed to decode showFeedback payload")
            }
        }
        
        hubConnection?.on(method: "dismiss") { [weak self] _ in
            print("SignalRService: dismiss received")
            DispatchQueue.main.async {
                self?.delegate?.gatewayDismiss()
            }
        }
        
        hubConnection?.on(method: "ping") { [weak self] arguments in
            print("SignalRService: ping received")
            // Respond with pong
            let payload = arguments.first as? [String: Any] ?? [:]
            self?.invokePong(payload: payload)
        }
        
        hubConnection?.on(method: "lockAssigned") { [weak self] arguments in
            guard let self = self,
                  let payload = arguments.first as? [String: Any] else { return }
            
            print("SignalRService: lockAssigned received")
            if let decoded: LockAssignedPayload = Self.decode(payload) {
                DispatchQueue.main.async {
                    self.delegate?.gatewayLockAssigned(decoded, raw: payload)
                }
            }
        }
        
        hubConnection?.on(method: "modeChanged") { [weak self] arguments in
            guard let self = self,
                  let payload = arguments.first as? [String: Any],
                  let modeString = payload["mode"] as? String,
                  let mode = DeviceMode(rawValue: modeString) else { return }
            
            print("SignalRService: modeChanged received: \(mode)")
            DispatchQueue.main.async {
                self.delegate?.gatewayModeChanged(mode)
            }
        }
        
        hubConnection?.on(method: "unpaired") { [weak self] _ in
            print("SignalRService: unpaired received from server")
            DispatchQueue.main.async {
                self?.delegate?.gatewayDeviceUnpaired()
            }
        }
    }
    
    // MARK: - Device to Server Hub Methods
    
    func invokePong(payload: [String: Any] = [:]) {
        hubConnection?.invoke(method: "pong", arguments: [payload]) { error in
            if let error = error {
                print("SignalRService: Failed to send pong: \(error)")
            }
        }
    }
    
    func invokeDelivered(sessionId: String) {
        let payload = ["sessionId": sessionId]
        hubConnection?.invoke(method: "delivered", arguments: [payload]) { error in
            if let error = error {
                print("SignalRService: Failed to send delivered: \(error)")
            }
        }
    }
    
    func invokeFeedbackCancelled(sessionId: String) {
        let payload = ["sessionId": sessionId]
        hubConnection?.invoke(method: "feedbackCancelled", arguments: [payload]) { error in
            if let error = error {
                print("SignalRService: Failed to send feedbackCancelled: \(error)")
            }
        }
    }
    
    func invokeLease() {
        guard let deviceId = authProvider.deviceId else { return }
        let payload = ["deviceId": deviceId]
        hubConnection?.invoke(method: "lease", arguments: [payload]) { error in
            if let error = error {
                print("SignalRService: Failed to send lease: \(error)")
            }
        }
    }
    
    func invokeStatus() {
        hubConnection?.invoke(method: "status", arguments: []) { error in
            if let error = error {
                print("SignalRService: Failed to send status: \(error)")
            }
        }
    }
    
    // MARK: - Helper Methods
    
    private func getSignalRConnectionInfo() async throws -> SignalRConnectionInfo {
        // Get the SignalR connection info from the backend using the ApiClient
        let response = try await apiClient.getSignalRConnectionInfo()
        
        // Store the SignalR token and endpoint
        try authProvider.storeSignalRInfo(token: response.token, endpoint: response.url)
        
        return SignalRConnectionInfo(
            url: response.url,
            token: response.token,
            deviceId: response.deviceId,
            mode: response.mode
        )
    }
    
    private static func decode<T: Decodable>(_ dict: [String: Any]) -> T? {
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

// MARK: - SignalR Connection Info Models

struct SignalRConnectionInfo: Codable {
    let url: String
    let token: String
    let deviceId: String
    let mode: String
}

// MARK: - DeviceMode enum (if not already defined elsewhere)

enum DeviceMode: String, CaseIterable {
    case dual = "DUAL"
    case feedbackOnly = "FEEDBACK_ONLY"
    case registration = "REGISTRATION"
    case feedback = "FEEDBACK"
}

// Keep the existing payload structs for compatibility
// These should match the existing definitions in SocketService.swift
