// Core/AppEnvironment.swift
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
    let modeStore = DeviceModeStore()
    var gatewayCenter = GatewayCenter()
    
    private init() {
        // 优先使用xcconfig配置，fallback到localhost
        let apiString = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String 
            ?? Bundle.main.object(forInfoDictionaryKey: "INFOPLIST_KEY_API_BASE_URL") as? String 
            ?? "https://api.localhost/api/app"
        
        print("AppEnvironment: All Info.plist keys:", Bundle.main.infoDictionary?.keys.sorted() ?? [])
        print("AppEnvironment: API_BASE_URL from Bundle: \(Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") ?? "nil")")
        print("AppEnvironment: INFOPLIST_KEY_API_BASE_URL from Bundle: \(Bundle.main.object(forInfoDictionaryKey: "INFOPLIST_KEY_API_BASE_URL") ?? "nil")")
        print("AppEnvironment: Final API URL: \(apiString)")

        guard let apiURL = URL(string: apiString) else { fatalError("Bad base URL: \(apiString)") }
        self.apiBaseURL = apiURL

        let keychain = KeychainStore(service: "com.yourorg.kiosk")
        let auth = DeviceAuthProvider(keychain: keychain)
        self.authProvider = auth
        self.apiClient = ApiClient(baseURL: apiURL, authProvider: auth)

        self.pairAPI = PairAPI(client: apiClient)
        self.casesAPI = CasesAPI(client: apiClient)
        self.feedbackAPI = FeedbackAPI(client: apiClient)

        self.signalRService = SignalRService(apiBaseURL: apiURL, authProvider: auth, apiClient: apiClient)
        
    }
}
