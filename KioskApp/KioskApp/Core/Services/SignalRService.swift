//
//  SignalRService.swift
//  KioskApp
//

import Foundation
import SignalRClient

// MARK: - 基础模型（与后端文档一致）
struct StaffInfo: Codable { let id: String; let name: String? }
struct FeedbackShowPayload: Codable {
    let sessionId: String
    let caseId: String
    let staff: StaffInfo
    let expireAt: String
}

struct ModeChangedPayload: Codable { let mode: DeviceMode }
struct PingPayload: Codable { let now: String? }

// 服务端 → 设备的 Envelope（统一 {type, payload}）
struct ServerEnvelope: Codable {
    let type: String
    let payload: JSONValue?
}

// 设备 → 服务端的 Envelope（统一 {type, payload}）
struct ClientEnvelope<Payload: Encodable>: Encodable {
    let type: String
    let payload: Payload?
}

// 任意 JSON 值（用来接 envelope.payload 动态解码）
enum JSONValue: Codable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let b = try? c.decode(Bool.self) { self = .bool(b); return }
        if let d = try? c.decode(Double.self) { self = .number(d); return }
        if let s = try? c.decode(String.self) { self = .string(s); return }
        if let a = try? c.decode([JSONValue].self) { self = .array(a); return }
        if let o = try? c.decode([String: JSONValue].self) { self = .object(o); return }
        throw DecodingError.dataCorrupted(.init(codingPath: c.codingPath, debugDescription: "Unsupported JSON"))
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let b): try c.encode(b)
        case .number(let d): try c.encode(d)
        case .string(let s): try c.encode(s)
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        }
    }

    /// 将 JSONValue 转回任意 Foundation 对象
    func toAny() -> Any {
        switch self {
        case .null: return NSNull()
        case .bool(let b): return b
        case .number(let d):
            // 尽量保持整数外观
            return floor(d) == d ? NSNumber(value: Int64(d)) : d
        case .string(let s): return s
        case .array(let a): return a.map { $0.toAny() }
        case .object(let o): return Dictionary(uniqueKeysWithValues: o.map { ($0.key, $0.value.toAny()) })
        }
    }

    /// payload → 具体类型
    func decodePayload<T: Decodable>(as: T.Type) throws -> T {
        let any = toAny()
        guard JSONSerialization.isValidJSONObject(any) else {
            // 基本类型时也支持（如 string/number/bool）
            let data = try JSONEncoder().encode(self)
            return try JSONDecoder().decode(T.self, from: data)
        }
        let data = try JSONSerialization.data(withJSONObject: any, options: [])
        return try JSONDecoder().decode(T.self, from: data)
    }
}

// MARK: - 委托
@MainActor
protocol SignalRServiceDelegate: AnyObject {
    func signalRConnected()
    func signalRDisconnected()
    func signalRReconnected()
    func signalRReceived(_ envelope: ServerEnvelope)
    func signalRError(_ error: Error)
}

// MARK: - 服务
@MainActor
final class SignalRService: @unchecked Sendable {
    // 与后端 REST/Upstream 完全一致的“方法名”
    private let serverToDeviceTarget = "deviceMessage" // 服务端 → 客户端
    private let deviceToServerMethod = "deviceEvent"   // 客户端 → 服务端

    private let api: ApiClient
    private let auth: AuthProviding
    private var connection: HubConnection?
    private(set) var isConnected = false
    private var isConnecting = false

    weak var delegate: SignalRServiceDelegate?

    init(apiClient: ApiClient, authProvider: AuthProviding) {
        self.api = apiClient
        self.auth = authProvider
    }

    /// 建立连接（自动完成 App JWT → negotiate → 构建 HubConnection）
    func connect() {
        if isConnecting || isConnected {
            print("ℹ️ [SignalRService] connect() skipped (isConnecting=\(isConnecting), isConnected=\(isConnected))")
            return
        }
        isConnecting = true
        Task { [weak self] in
            guard let self else { return }
            do {
                // 1) 若缺少 App JWT，先用设备 API Key 换取
                if self.auth.appJwt == nil {
                    let jwt = try await self.api.generateDeviceJWT()
                    try self.auth.storeAppJwt(jwt.appJwt)
                }

                // 2) 调 negotiate（/api/negotiate），拿到 url + accessToken
                let info = try await self.api.getSignalRConnectionInfo()
                try self.auth.storeSignalRInfo(token: info.token, endpoint: info.url) // Keychain 持久化
                // 3) 构建 HubConnection（将 accessToken 提供给每次请求）
                var options = HttpConnectionOptions()
                options.accessTokenFactory = { [weak self] in
                    await self?.auth.signalRToken ?? ""
                }

                let conn = HubConnectionBuilder()
                    .withUrl(url: info.url, options: options) // 传入 token 工厂（Serverless 必需）
                    .withAutomaticReconnect(retryDelays: [0, 2, 10, 30])   // 官方默认回连策略
                    .build()

                // 注册回调应在 start() 之前（官方最佳实践）
                await conn.on(serverToDeviceTarget) { (envelope: ServerEnvelope) in
                    Task { @MainActor in
                        self.delegate?.signalRReceived(envelope)
                    }
                }

                await conn.onReconnecting { error in
                    Task { @MainActor in
                        self.isConnected = false
                        if let error { self.delegate?.signalRError(error) }
                    }
                }
                await conn.onReconnected {
                    Task { @MainActor in
                        self.isConnected = true
                        self.delegate?.signalRReconnected()
                    }
                }

                try await conn.start()
                print("✅ [SignalRService] HubConnection started")
                await MainActor.run {
                    self.connection = conn
                    self.isConnected = true
                    self.isConnecting = false
                    self.delegate?.signalRConnected()
                }
            } catch {
                await MainActor.run {
                    self.isConnected = false
                    self.isConnecting = false
                    self.delegate?.signalRError(error)
                }
            }
        }
    }

    func disconnect() {
        Task {
            await connection?.stop()
            await MainActor.run {
                isConnected = false
                delegate?.signalRDisconnected()
            }
        }
    }

    // MARK: - 设备 → 服务端：便捷发送
    func sendPong(payload: PingPayload? = nil) async throws {
        try await send(type: "PONG", payload: payload)
    }

    func sendDelivered(sessionId: String) async throws {
        struct Delivered: Encodable { let sessionId: String }
        try await send(type: "DELIVERED", payload: Delivered(sessionId: sessionId))
    }

    func sendLease(deviceId: String) async throws {
        struct Lease: Encodable { let deviceId: String }
        try await send(type: "LEASE", payload: Lease(deviceId: deviceId))
    }

    func sendStatus() async throws {
        // 无 payload
        try await send(type: "STATUS", payload: EmptyCodable())
    }

    func sendFeedbackUpdate<T: Encodable>(payload: T?) async throws {
        try await send(type: "FEEDBACK_UPDATE", payload: payload)
    }

    func sendFeedbackCancelled(sessionId: String) async throws {
        struct Cancelled: Encodable { let sessionId: String }
        try await send(type: "FEEDBACK_CANCELLED", payload: Cancelled(sessionId: sessionId))
    }

    // 泛型封装：发送统一的 {type, payload}
    private func send<T: Encodable>(type: String, payload: T?) async throws {
        guard let conn = connection else {
            throw NSError(domain: "SignalRService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Connection is not started"])
        }
        // 注意：SignalR Swift 的 send 支持将 Encodable 作为单个参数传递
        let envelope = ClientEnvelope(type: type, payload: payload)
        try await conn.send(method: deviceToServerMethod, arguments: envelope)
    }
}

/// 空 payload 的占位类型
private struct EmptyCodable: Encodable {}
extension SignalRService {
    /// 兼容调用：发送“状态心跳”= PONG(now: ISO8601)
    func sendStatusPing() async throws {
        let now = ISO8601DateFormatter().string(from: Date())
        try await self.sendPong(payload: PingPayload(now: now))
    }

    /// 非阻塞便捷版（无需 await/try，在非 async 场景直接用）
    @discardableResult
    func sendStatusPingNow() -> Task<Void, Never> {
        Task { try? await self.sendStatusPing() }
    }

    func reconnect() {
        Task { [weak self] in
            guard let self else { return }
            if self.isConnected {
                await self.connection?.stop()
                self.isConnected = false
            }
            self.connect()
        }
    }
}
