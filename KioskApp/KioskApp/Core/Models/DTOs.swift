// 设备模式枚举 —— 与 Prisma 一致
enum DeviceMode: String, Codable {
    case REGISTRATION, FEEDBACK
}

enum DeviceStatus: String, Codable {
    case OFFLINE, IDLE, BUSY
}

// iPad 本地保存的调用凭据（配对后写入 Keychain）
struct DeviceCredentials: Codable, Equatable {
    let deviceId: String
    let apiKey: String          // HTTP API 认证
    let wsToken: String?        // WebSocket JWT 认证 token
    let wsEndpoint: String?     // WebSocket 端点 URL
    let mode: DeviceMode
}

// /pair/complete
struct PairCompleteRequest: Encodable {
    let pairingToken: String
    let deviceName: String
    let mode: String?
}
struct PairCompleteResponse: Decodable {
    let deviceId: String?
    let deviceSecret: String?
    let apiKey: String?
    let wsToken: String?         // WebSocket JWT 认证 token
    let deviceName: String?
    let deviceMode: String?      // "FEEDBACK|REGISTRATION"
    let wsEndpoint: String?      // WebSocket 端点 URL
    let mode: DeviceMode?        // 可选，向后兼容
    let success: Bool?
    let message: String?
}

// /cases
enum CaseStatus: String, Codable {
    case QUEUED
    case IN_PROGRESS
    case RESOLVED_PENDING_FEEDBACK
    case RESOLVED
}

struct CreateCaseRequest: Encodable {
    let studentName: String
    let category: String
    
    // 便捷初始化器，接受原来的参数名
    init(name: String, categoryId: String) {
        self.studentName = name
        self.category = categoryId
    }
}

struct CreateCaseResponse: Decodable {
    let id: String
    let status: CaseStatus
    let createdAt: String?
}

// /feedback/submit
struct SubmitFeedbackRequest: Encodable {
    let sessionId: String
    let rating: Int
    let comment: String?
    
    init(sessionId: String, rating: Int, text: String?) {
        self.sessionId = sessionId
        self.rating = rating
        self.comment = text
    }
}
struct SubmitFeedbackResponse: Decodable { let ok: Bool? }
