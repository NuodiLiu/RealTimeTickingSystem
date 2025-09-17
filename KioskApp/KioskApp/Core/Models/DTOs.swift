// 设备模式枚举 —— 与 Prisma 一致
enum DeviceMode: String, Codable {
    case REGISTRATION, FEEDBACK
}

enum DeviceStatus: String, Codable {
    case OFFLINE, IDLE, BUSY
}

// iPad locally stored credentials
struct DeviceCredentials: Codable, Equatable {
    let deviceId: String
    let apiKey: String         
    let wsToken: String?       
    let wsEndpoint: String?   
    let mode: DeviceMode
}

// /pair/complete
struct PairCompleteRequest: Encodable {
    let pairingToken: String
    let deviceName: String
    let mode: String?
}
struct PairCompleteResponse: Decodable {
    let deviceId: String
    let deviceSecret: String
    let apiKey: String
    let wsToken: String?         
    let deviceName: String
    let mode: DeviceMode
    let wsEndpoint: String?
}

// /cases
enum CaseStatus: String, Codable {
    case QUEUED
    case IN_PROGRESS
    case RESOLVED_PENDING_FEEDBACK
    case RESOLVED
}

struct CreateCaseRequest: Encodable {
    let zID: String?
    let studentName: String
    let category: String
    
    init(zID: String?, name: String, categoryId: String) {
        self.zID = zID
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
