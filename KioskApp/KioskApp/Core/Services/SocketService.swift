// Core/Services/SocketService.swift
import Foundation
import SocketIO
import UIKit

final class SocketService {
    private var manager: SocketManager?
    private var socket: SocketIOClient?
    private let wsBaseURL: URL
    private let authProvider: AuthProviding
    private let apiClient: ApiClient
    private var isIntentionallyDisconnected = false
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    weak var delegate: DeviceGatewayDelegate?

    init(wsBaseURL: URL, authProvider: AuthProviding, apiClient: ApiClient) {
        self.wsBaseURL = wsBaseURL
        self.authProvider = authProvider
        self.apiClient = apiClient
        setupApplicationLifecycleNotifications()
    }
    
    deinit {
        removeApplicationLifecycleNotifications()
        endBackgroundTask()
    }
    
    // Application Lifecycle Management
    
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
        print("📱 SocketService: App entering foreground, checking connection...")
        endBackgroundTask()
        
        // if valid token and deviceId, and was not intentionally disconnected, reconnect if needed
        if authProvider.wsToken != nil && authProvider.deviceId != nil && !isIntentionallyDisconnected {
            if socket?.status != .connected {
                print("SocketService: Auto-reconnecting on foreground...")
                connect()
            }
        }
    }
    
    @objc private func applicationDidEnterBackground() {
        print("SocketService: App entering background, starting background task...")
        
        backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
            print("📱 SocketService: Background task expired")
            self?.endBackgroundTask()
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.endBackgroundTask()
        }
    }
    
    @objc private func applicationWillTerminate() {
        print("SocketService: App will terminate, disconnecting...")
        disconnect()
    }
    
    private func endBackgroundTask() {
        if backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }
    }

    func connect() {
        Task {
            await performConnect()
        }
    }
    
    @MainActor
    private func performConnect() async {
        guard let wsToken = authProvider.wsToken,
              let deviceId = authProvider.deviceId else {
            print("SocketService.connect() skipped: no WebSocket token or device ID available")
            return
        }

        print("SocketService.connect() starting with wsToken: \(String(wsToken.prefix(20)))...")
        print("SocketService: Checking pairing status for device: \(String(deviceId.prefix(8)))...")
        
        do {
            let isPaired = try await apiClient.checkPairingStatus(deviceId: deviceId)
            if !isPaired {
                print("SocketService: Device is no longer paired on server, clearing credentials...")
                
                do {
                    try authProvider.clearDevice()
                } catch {
                    print("SocketService: Failed to clear device credentials: \(error)")
                }
                delegate?.gatewayDeviceUnpaired()
                return
            }
            print("SocketService: Device pairing status confirmed, proceeding with connection...")
        } catch {
            print("SocketService: Failed to check pairing status: \(error)")
            print("SocketService: Proceeding with connection anyway...")
        }
        
        isIntentionallyDisconnected = false

        if let s = socket, s.status == .connected { 
            print("SocketService: Disconnecting existing connection")
            s.disconnect() 
        }
        socket = nil
        manager = nil

        let socketURL = authProvider.wsEndpoint.flatMap(URL.init) ?? wsBaseURL
        print("SocketService: Connecting to \(socketURL)")

        let cfg: SocketIOClientConfiguration = [
            .log(false),  
            .compress,
            .path("/ws"),
            .forceWebsockets(true),
            .reconnects(true),
            .reconnectAttempts(-1),  
            .reconnectWait(2),
            .reconnectWaitMax(10),  
            .extraHeaders([
                "Authorization": "Bearer \(wsToken)",
                "Origin": socketURL.absoluteString,
                "User-Agent": "KioskApp-iOS/1.0"
            ]),
            .forceNew(false)  
        ]

        let manager = SocketManager(socketURL: socketURL, config: cfg)
        let socket = manager.defaultSocket
        self.manager = manager
        self.socket = socket

        print("SocketService: Socket manager created, attempting connection...")

        // 客户端事件
        socket.on(clientEvent: .connect) { [weak self] _,_ in 
            print("SocketService: Connected successfully!")
            self?.delegate?.gatewayDidConnect() 
        }
        
        socket.on(clientEvent: .disconnect) { [weak self] data,_ in 
            print("SocketService: Disconnected - reason: \(data)")
            self?.delegate?.gatewayDidDisconnect() 
        }
        
        socket.on(clientEvent: .error) { data,_ in 
            print("SocketService: Connection error: \(data)") 
        }
        
        socket.on(clientEvent: .reconnect) { [weak self] _,_ in
            print("SocketService: Reconnected successfully!")
            self?.delegate?.gatewayDidConnect()
        }
        
        socket.on(clientEvent: .reconnectAttempt) { data,_ in
            print("SocketService: Reconnection attempt: \(data)")
        }

        socket.on("message") { [weak self] data,_ in
            guard let self else { return }
            
            print("SocketService: Raw message received: \(data)")
            
            guard let dict = data.first as? [String: Any],
                  let type = dict["type"] as? String else { 
                print("SocketService: Failed to parse message - invalid format")
                return 
            }
            
            let payload = dict["payload"]
            print("SocketService: Parsed message - type: '\(type)', payload: \(payload ?? "nil")")

            switch type {
            case "PING": 
                self.emit(type: "PONG")
            case "SHOW_FEEDBACK":
                print("SocketService: *** SHOW_FEEDBACK received ***")
                print("SocketService: Payload: \(payload ?? "nil")")
                if let raw = payload as? [String: Any],
                   let decoded: FeedbackShowPayload = Self.decode(raw) {
                    print("SocketService: Successfully decoded SHOW_FEEDBACK, calling delegate")
                    self.delegate?.gatewayShowFeedback(decoded, raw: raw)
                } else { 
                    print("Failed to decode SHOW_FEEDBACK payload: \(payload ?? "Default")")
                    // Don't call delegate with invalid data
                }
            case "DISMISS": 
                self.delegate?.gatewayDismiss()
            case "LOCK_ASSIGNED":
                if let raw = payload as? [String: Any],
                   let decoded: LockAssignedPayload = Self.decode(raw) {
                    self.delegate?.gatewayLockAssigned(decoded, raw: raw)
                }
            case "MODE_CHANGED":
                if let raw = payload as? [String: Any],
                   let m = (raw["mode"] as? String).flatMap(DeviceMode.init(rawValue:)) {
                    self.delegate?.gatewayModeChanged(m)
                }
            case "DEVICE_UNPAIRED", "UNPAIRED":
                print("SocketService: Received \(type) event from server")
                self.delegate?.gatewayDeviceUnpaired()
            default: 
                print("SocketService: Unknown message type: \(type)")
                break
            }
        }

        socket.connect()
    }

    func disconnect() {
        print("SocketService: Manual disconnect requested")
        isIntentionallyDisconnected = true
        socket?.disconnect()
        socket = nil
        manager = nil
        endBackgroundTask()
    }
    
    func reconnect() {
        print("SocketService: Manual reconnect requested")
        if authProvider.wsToken != nil && authProvider.deviceId != nil {
            connect()
        } else {
            print("SocketService: Cannot reconnect - no WebSocket token or device ID")
        }
    }

    var isConnected: Bool { socket?.status == .connected }

    // 上行
    func sendDelivered(sessionId: String) { emit(type: "DELIVERED", payload: ["sessionId": sessionId]) }
    func sendFeedbackCancelled(sessionId: String) { emit(type: "FEEDBACK_CANCELLED", payload: ["sessionId": sessionId]) }
    func sendLeaseTick() { emit(type: "LEASE") }
    func sendStatusPing() { emit(type: "STATUS") }

    // tool
    private func emit(type: String, payload: [String: Any]? = nil) {
        var obj: [String: Any] = ["type": type]
        if let p = payload { obj["payload"] = p }
        socket?.emit("message", obj)
    }

    private static func decode<T: Decodable>(_ dict: [String: Any]) -> T? {
        guard JSONSerialization.isValidJSONObject(dict),
              let data = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
}

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

struct LockAssignedPayload: Decodable { let lockId: String?; let caseId: String?; let staffName: String?; let leaseExpireAt: String? }
