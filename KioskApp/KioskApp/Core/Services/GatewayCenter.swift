// Core/Services/GatewayCenter.swift
import Foundation
import Combine

/// 将 SignalR 收到的消息转换为可订阅的 UI 事件
final class GatewayCenter: ObservableObject, SignalRServiceDelegate {

    // MARK: - 对外事件（供外部使用 $publisher 订阅）
    @Published var modeChanged: DeviceMode?                  // 订阅：env.gatewayCenter.$modeChanged
    @Published var showFeedback: FeedbackShowPayload?        // 订阅：env.gatewayCenter.$showFeedback
    @Published var deviceUnpaired: Bool = false              // 订阅：env.gatewayCenter.$deviceUnpaired
    @Published var lastPing: PingPayload?                    // 可选：最近一次 PING
    @Published var socketConnected: Bool = false 

    private let signalR: SignalRService

    init(signalR: SignalRService) {
        self.signalR = signalR
    }

    // 也可让 RootViewModel 直接调用 start/stop；你目前是在外部设置 delegate 并调用 connect()，两种都可。
    func start() {
        signalR.delegate = self
        signalR.connect()
    }

    func stop() {
        signalR.disconnect()
    }

    // MARK: - SignalRServiceDelegate

    func signalRConnected() {
        // SignalRService 已经在主线程调用
        self.socketConnected = true
        print("🔌 [GatewayCenter] SignalR CONNECTED")
    }
    
    func signalRDisconnected() {
        self.socketConnected = false
        print("🔌 [GatewayCenter] SignalR DISCONNECTED")
    }
    
    func signalRReconnected() {
        self.socketConnected = true
        print("🔌 [GatewayCenter] SignalR RECONNECTED")
    }
    
    func signalRError(_ error: Error) {
        print("❌ [GatewayCenter] SignalR ERROR:", error)
    }

    /// 收到服务端 Envelope（{type, payload}）
    func signalRReceived(_ envelope: ServerEnvelope) {
        // SignalRService 已经在主线程调用此方法，无需再次 dispatch
        switch envelope.type {
        case "SHOW_FEEDBACK":
            if let p = try? envelope.payload?.decodePayload(as: FeedbackShowPayload.self) {
                self.showFeedback = p
            }

        case "DISMISS":
            // 清除当前展示
            self.showFeedback = nil

        case "PING":
            let p = try? envelope.payload?.decodePayload(as: PingPayload.self)
            self.lastPing = p
            
            // ✅ 自动回复 PONG
            Task {
                let now = ISO8601DateFormatter().string(from: Date())
                try? await signalR.sendPong(payload: PingPayload(now: now))
                print("💓 [GatewayCenter] Auto-replied PONG to server")
            }

        case "MODE_CHANGED":
            if let m = try? envelope.payload?.decodePayload(as: ModeChangedPayload.self) {
                self.modeChanged = m.mode
            }

        case "UNPAIRED":
            self.deviceUnpaired = true

        case "LOCK_ASSIGNED":
            // 如有需要，这里也可以发布一个 @Published 事件
            break

        default:
            // 未知类型，忽略或记录
            break
        }
    }
}
