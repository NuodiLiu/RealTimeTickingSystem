// Core/AppEnvironment.swift
import Foundation

final class AppEnvironment {
    static let shared = AppEnvironment()

    let apiBaseURL: URL
    let wsBaseURL: URL
    let authProvider: AuthProviding
    let apiClient: ApiClient

    let pairAPI: PairAPI
    let casesAPI: CasesAPI
    let feedbackAPI: FeedbackAPI
    let socketService: SocketService
    let modeStore = DeviceModeStore()
    var gatewayCenter = GatewayCenter()
    
    private init() {
        // 改回localhost连接
        let api = "http://localhost:3000"
        let ws  = "http://localhost:3000"
        
        // 保留调试信息以备后续配置使用
        print("📱 AppEnvironment: API_BASE_URL from Bundle: \(Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") ?? "nil")")
        print("📱 AppEnvironment: INFOPLIST_KEY_API_BASE_URL from Bundle: \(Bundle.main.object(forInfoDictionaryKey: "INFOPLIST_KEY_API_BASE_URL") ?? "nil")")
        print("📱 AppEnvironment: WS_BASE_URL from Bundle: \(Bundle.main.object(forInfoDictionaryKey: "WS_BASE_URL") ?? "nil")")
        print("📱 AppEnvironment: INFOPLIST_KEY_WS_BASE_URL from Bundle: \(Bundle.main.object(forInfoDictionaryKey: "INFOPLIST_KEY_WS_BASE_URL") ?? "nil")")
        print("📱 AppEnvironment: Using localhost API URL: \(api)")
        print("📱 AppEnvironment: Using localhost WS URL: \(ws)")

        guard let apiURL = URL(string: api), let wsURL = URL(string: ws) else { fatalError("Bad base URLs") }
        self.apiBaseURL = apiURL
        self.wsBaseURL  = wsURL

        let keychain = KeychainStore(service: "com.yourorg.kiosk")
        let auth = DeviceAuthProvider(keychain: keychain)
        self.authProvider = auth
        self.apiClient = ApiClient(baseURL: apiURL, authProvider: auth)

        self.pairAPI = PairAPI(client: apiClient)
        self.casesAPI = CasesAPI(client: apiClient)
        self.feedbackAPI = FeedbackAPI(client: apiClient)

        self.socketService = SocketService(wsBaseURL: wsURL, authProvider: auth)
        
    }
}
