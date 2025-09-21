//
//  ApiClient.swift
//  KioskApp
//

import Foundation

enum HTTPMethod: String { 
    case GET, POST, PUT, PATCH, DELETE 
}

public struct EmptyResponse: Codable { 
    public init() {} 
}

struct Endpoint<Response: Decodable> {
    let path: String
    let method: HTTPMethod
    let needsDeviceAuth: Bool
    let needsAppJwt: Bool
    var query: [URLQueryItem] = []
    var headers: [String: String] = [:]
    
    // 便利构造器保持向后兼容
    init(path: String, method: HTTPMethod, needsDeviceAuth: Bool = false, needsAppJwt: Bool = false, query: [URLQueryItem] = [], headers: [String: String] = [:]) {
        self.path = path
        self.method = method
        self.needsDeviceAuth = needsDeviceAuth
        self.needsAppJwt = needsAppJwt
        self.query = query
        self.headers = headers
    }
}

public enum ApiError: LocalizedError {
    case badURL
    case unauthorized(String?)
    case forbidden(String?)
    case notFound(String?)
    case validation(String?)
    case rateLimited(retryAfter: TimeInterval?)
    case server(String?)
    case decoding(String)
    case network(URLError)
    case unknown(String?)

    public var errorDescription: String? {
        switch self {
        case .badURL: return "Bad URL"
        case .unauthorized(let m): return m ?? "Unauthorized"
        case .forbidden(let m): return m ?? "Forbidden"
        case .notFound(let m): return m ?? "Not Found"
        case .validation(let m): return m ?? "Validation failed"
        case .rateLimited: return "Too many requests"
        case .server(let m): return m ?? "Server error"
        case .decoding(let m): return "Decoding error: \(m)"
        case .network(let e): return e.localizedDescription
        case .unknown(let m): return m ?? "Unknown error"
        }
    }
}

// MARK: - ApiClient

final class ApiClient {
    private let baseURL: URL
    private let authProvider: AuthProviding
    private let urlSession: URLSession

    init(baseURL: URL, authProvider: AuthProviding, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.authProvider = authProvider
        self.urlSession = session
    }

    func request<Body: Encodable, Response: Decodable>(
        _ endpoint: Endpoint<Response>,
        body: Body? = nil
    ) async throws -> Response {
        // Build URL
        var url = baseURL
        url.appendPathComponent(endpoint.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        guard var comps = URLComponents(url: url, resolvingAgainstBaseURL: false) else { 
            throw ApiError.badURL 
        }
        comps.queryItems = endpoint.query.isEmpty ? nil : endpoint.query
        guard let finalURL = comps.url else { 
            throw ApiError.badURL 
        }

        // Build Request
        var req = URLRequest(url: finalURL)
        req.httpMethod = endpoint.method.rawValue
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Authentication headers
        if endpoint.needsDeviceAuth, let key = authProvider.deviceApiKey {
            req.setValue("Device \(key)", forHTTPHeaderField: "Authorization")
        } else if endpoint.needsAppJwt, let jwt = authProvider.appJwt {
            req.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
        }
        
        // Extra headers
        for (k, v) in endpoint.headers { 
            req.setValue(v, forHTTPHeaderField: k) 
        }
        
        // Body
        if let body {
            req.httpBody = try JSONEncoder().encode(body)
        }

        let maxAttempts = 2
        var attempt = 0
        var lastError: Error?

        while attempt < maxAttempts {
            do {
                let (data, resp) = try await urlSession.data(for: req)
                return try handleResponse(data: data, response: resp)
            } catch {
                if let urlErr = error as? URLError {
                    lastError = ApiError.network(urlErr)
                    // retry on transient conditions
                    if urlErr.code == .timedOut ||
                       urlErr.code == .networkConnectionLost ||
                       urlErr.code == .cannotFindHost ||
                       urlErr.code == .cannotConnectToHost {
                        attempt += 1
                        try? await Task.sleep(nanoseconds: UInt64(0.5 * 1_000_000_000) * UInt64(attempt))
                        continue
                    }
                }
                lastError = error
                break
            }
        }
        throw lastError ?? ApiError.unknown(nil)
    }
    
    // Convenience method for requests without body
    func request<Response: Decodable>(_ endpoint: Endpoint<Response>) async throws -> Response {
        return try await request(endpoint, body: nil as EmptyResponse?)
    }

    private func handleResponse<Response: Decodable>(data: Data, response: URLResponse) throws -> Response {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ApiError.unknown("Invalid response type")
        }
        
        let statusCode = httpResponse.statusCode
        
        switch statusCode {
        case 200...299:
            // Success case - decode the response
            break
        case 400:
            throw ApiError.validation(String(data: data, encoding: .utf8))
        case 401:
            throw ApiError.unauthorized(String(data: data, encoding: .utf8))
        case 403:
            throw ApiError.forbidden(String(data: data, encoding: .utf8))
        case 404:
            throw ApiError.notFound(String(data: data, encoding: .utf8))
        case 429:
            let retryAfter = httpResponse.value(forHTTPHeaderField: "Retry-After")
                .flatMap(TimeInterval.init)
            throw ApiError.rateLimited(retryAfter: retryAfter)
        case 500...599:
            throw ApiError.server(String(data: data, encoding: .utf8))
        default:
            throw ApiError.unknown("HTTP \(statusCode)")
        }
        
        do {
            let decoder = JSONDecoder()
            return try decoder.decode(Response.self, from: data)
        } catch {
            if data.isEmpty { 
                throw ApiError.decoding("Empty body") 
            }
            throw ApiError.decoding(String(describing: error))
        }
    }
    
    /// Check if a device is still paired/valid on the server
    func checkPairingStatus(deviceId: String) async throws -> Bool {
        let endpoint = Endpoint<PairingStatusResponse>(
            path: "/device/pairing-status/\(deviceId)",
            method: .GET,
            needsDeviceAuth: false
        )
        let response: PairingStatusResponse = try await request(endpoint)
        return response.isPaired
    }
    
    /// Get SignalR connection information for the device
    func getSignalRConnectionInfo() async throws -> SignalRConnectionResponse {
        print("ApiClient: [Negotiate] Calling negotiate endpoint with App JWT...")
        print("ApiClient: [Negotiate] BaseURL: \(baseURL)")
        print("ApiClient: [Negotiate] Endpoint path: /api/negotiate (not under /api/app)")
        print("ApiClient: [Negotiate] Auth method: App JWT (Bearer token)")
        
        let endpoint = Endpoint<SignalRConnectionResponse>(
            path: "../negotiate",   // 回到上级目录: /api/app/../negotiate = /api/negotiate
            method: .POST,
            needsDeviceAuth: false,  // 不使用 Device 认证
            needsAppJwt: true        // 使用 App JWT 认证
        )
        
        let response = try await request(endpoint)
        
        print("ApiClient: [Negotiate] Successfully received SignalR connection info")
        print("ApiClient: [Negotiate] SignalR URL: \(response.url)")
        print("ApiClient: [Negotiate] Device ID: \(response.deviceId)")
        print("ApiClient: [Negotiate] Mode: \(response.mode)")
        
        return response
    }
    
    /// Generate App JWT for device
    func generateDeviceJWT() async throws -> DeviceJWTResponse {
        let endpoint = Endpoint<DeviceJWTResponse>(
            path: "/device/token",   // 设备JWT端点
            method: .POST,
            needsDeviceAuth: true    // 使用 Device API Key 获取 JWT
        )
        return try await request(endpoint)
    }
}

// MARK: - Response Models

struct PairingStatusResponse: Decodable {
    let isPaired: Bool
}

struct SignalRConnectionResponse: Decodable {
    let url: String
    let token: String
    let deviceId: String
    let mode: String
    
    enum CodingKeys: String, CodingKey {
        case url
        case token = "accessToken"
        case user
    }
    
    struct User: Decodable {
        let id: String
        let type: String
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        url = try container.decode(String.self, forKey: .url)
        token = try container.decode(String.self, forKey: .token)
        
        let user = try container.decode(User.self, forKey: .user)
        deviceId = user.id
        mode = user.type
    }
}

struct DeviceJWTResponse: Decodable {
    let appJwt: String
    let expiresAt: String
}
