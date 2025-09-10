// Core/Services/SocketService.swift
import Foundation
import SocketIO

final class SocketService {
    private var manager: SocketManager?
    private var socket: SocketIOClient?
    private let wsBaseURL: URL
    private let authProvider: AuthProviding

    weak var delegate: DeviceGatewayDelegate?

    init(wsBaseURL: URL, authProvider: AuthProviding) {
        self.wsBaseURL = wsBaseURL
        self.authProvider = authProvider
    }

    /// 根据“当前”apiKey 动态创建 manager/socket 并连接
    func connect() {
        // 没配对就先不连
        guard let apiKey = authProvider.deviceApiKey else {
            print("SocketService.connect() skipped: no device apiKey yet")
            return
        }

        // 如果已有连接，先断开并销毁（避免旧 header）
        if let s = socket, s.status == .connected { s.disconnect() }
        socket = nil
        manager = nil

        let cfg: SocketIOClientConfiguration = [
            .log(false),
            .compress,
            .path("/ws"),
            .forceWebsockets(true),
            .reconnects(true),
            .reconnectAttempts(-1),
            .reconnectWait(2),
            .extraHeaders(["Authorization": "Device \(apiKey)"])
        ]

        let manager = SocketManager(socketURL: wsBaseURL, config: cfg)
        let socket = manager.defaultSocket
        self.manager = manager
        self.socket = socket

        // 客户端事件
        socket.on(clientEvent: .connect) { [weak self] _,_ in self?.delegate?.gatewayDidConnect() }
        socket.on(clientEvent: .disconnect) { [weak self] _,_ in self?.delegate?.gatewayDidDisconnect() }
        socket.on(clientEvent: .error) { data,_ in print("SOCKET error:", data) }

        // 统一“message”事件
        socket.on("message") { [weak self] data,_ in
            guard let self, let dict = data.first as? [String: Any],
                  let type = dict["type"] as? String else { return }
            let payload = dict["payload"]

            switch type {
            case "PING": self.emit(type: "PONG")
            case "SHOW_FEEDBACK":
                if let raw = payload as? [String: Any],
                   let decoded: FeedbackShowPayload = Self.decode(raw) {
                    self.delegate?.gatewayShowFeedback(decoded, raw: raw)
                } else { self.delegate?.gatewayShowFeedback(FeedbackShowPayload(sessionId: nil, caseId: nil, title: nil, message: nil),
                                                            raw: (payload as? [String: Any]) ?? [:]) }
            case "DISMISS": self.delegate?.gatewayDismiss()
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
            default: break
            }
        }

        socket.connect()
    }

    func disconnect() {
        socket?.disconnect()
        socket = nil
        manager = nil
    }

    var isConnected: Bool { socket?.status == .connected }

    // 上行
    func sendDelivered(sessionId: String) { emit(type: "DELIVERED", payload: ["sessionId": sessionId]) }
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
}

extension DeviceGatewayDelegate {
    func gatewayModeChanged(_ mode: DeviceMode) {}
}

struct FeedbackShowPayload: Decodable { let sessionId: String?; let caseId: String?; let title: String?; let message: String? }
struct LockAssignedPayload: Decodable { let lockId: String?; let caseId: String?; let staffName: String?; let leaseExpireAt: String? }
