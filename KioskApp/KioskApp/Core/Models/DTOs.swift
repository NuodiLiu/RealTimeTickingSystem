// 设备模式枚举 —— 与 Prisma 一致
enum DeviceMode: String, Codable {
    case REGISTRATION, FEEDBACK, DUAL
}

enum DeviceStatus: String, Codable {
    case OFFLINE, IDLE, BUSY
}

// iPad 本地保存的调用凭据（配对后写入 Keychain）
struct DeviceCredentials: Codable, Equatable {
    let deviceId: String
    let apiKey: String
    let mode: DeviceMode
}

// /pair/complete
struct PairCompleteRequest: Encodable {
    let pairingToken: String
    let mode: String?
}
struct PairCompleteResponse: Decodable {
    let deviceId: String
    let apiKey: String
    let mode: DeviceMode?   // 可选
}

// /cases
enum CaseStatus: String, Codable {
    case QUEUED
    case IN_PROGRESS
    case RESOLVED_PENDING_FEEDBACK
    case RESOLVED
}

struct CreateCaseRequest: Encodable {
    let name: String
    let categoryId: String
}

struct CreateCaseResponse: Decodable {
    let id: String
    let status: CaseStatus
    let createdAt: String?
}

// /feedback/submit
struct SubmitFeedbackRequest: Encodable {
    let caseId: String
    let rating: Int
    let text: String?
}
struct SubmitFeedbackResponse: Decodable { let ok: Bool? }
