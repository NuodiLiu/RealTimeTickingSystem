import Foundation

final class AppEnvironment {
    static let shared = AppEnvironment()

    let apiBaseURL: URL
    let authProvider: AuthProviding
    let apiClient: ApiClient

    let pairAPI: PairAPI
    let casesAPI: CasesAPI
    let feedbackAPI: FeedbackAPI
    let signalRService: SignalRService
    let gatewayCenter: GatewayCenter
    let modeStore = DeviceModeStore()

    private init() {
        // 优先使用 xcconfig 配置，fallback 到 localhost
        let apiString = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
            ?? "https://ticketing-backend-h7f6d8ccfhefcvdp.australiaeast-01.azurewebsites.net"

        // 打印环境配置信息
        print("========================================")
        print("🚀 KioskApp Environment Configuration")
        print("========================================")
        #if DEBUG
        print("📱 Build Configuration: DEBUG")
        #else
        print("📱 Build Configuration: RELEASE")
        #endif
        print("🌐 API Base URL: \(apiString)")
        print("========================================")

        guard let apiURL = URL(string: apiString) else { fatalError("Bad base URL: \(apiString)") }
        self.apiBaseURL = apiURL

        let keychain = KeychainStore(service: "com.yourorg.kiosk")
        let auth = DeviceAuthProvider(keychain: keychain)
        self.authProvider = auth

        self.apiClient = ApiClient(baseURL: apiURL, authProvider: auth)
        self.pairAPI = PairAPI(client: apiClient)
        self.casesAPI = CasesAPI(client: apiClient)
        self.feedbackAPI = FeedbackAPI(client: apiClient)

        // ✅ 使用实际存在的初始化签名
        self.signalRService = SignalRService(apiClient: apiClient, authProvider: auth)

        // ✅ 这里才能安全地用 signalRService 去构造 GatewayCenter
        self.gatewayCenter = GatewayCenter(signalR: self.signalRService)
    }
}
