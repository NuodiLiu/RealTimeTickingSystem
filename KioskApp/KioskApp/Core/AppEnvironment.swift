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
        let api = (Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String) ?? "http://127.0.0.1:3000"
        let ws  = (Bundle.main.object(forInfoDictionaryKey: "WS_BASE_URL")  as? String) ?? "http://127.0.0.1:3000"

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
