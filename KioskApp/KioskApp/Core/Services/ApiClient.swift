//
//  ApiClient.swift
//  KioskApp
//

import Foundation

enum HTTPMethod: String { case GET, POST, PUT, PATCH, DELETE }

public struct EmptyResponse: Decodable { public init() {} }

struct Endpoint<Response: Decodable> {
    let path: String
    let method: HTTPMethod
    let needsDeviceAuth: Bool
    var query: [URLQueryItem] = []
    var headers: [String: String] = [:]
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
        // --- Build URL
        var url = baseURL
        url.appendPathComponent(endpoint.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        guard var comps = URLComponents(url: url, resolvingAgainstBaseURL: false) else { throw ApiError.badURL }
        comps.queryItems = endpoint.query.isEmpty ? nil : endpoint.query
        guard let finalURL = comps.url else { throw ApiError.badURL }

        // --- Build Request
        var req = URLRequest(url: finalURL)
        req.httpMethod = endpoint.method.rawValue
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Device auth header
        if endpoint.needsDeviceAuth, let key = authProvider.deviceApiKey {
            req.setValue("Device \(key)", forHTTPHeaderField: "Authorization")
        }
        // Extra headers
        for (k, v) in endpoint.headers { req.setValue(v, forHTTPHeaderField: k) }
        // Body
        if let body {
            req.httpBody = try JSONEncoder().encode(body)
        }

        // --- Do request with tiny retry on transient network errors
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

    private struct ErrorBox: Decodable { let error: String? }
    
    private func handleResponse<Response: Decodable>(data: Data, response: URLResponse) throws -> Response {
        guard let http = response as? HTTPURLResponse else { throw ApiError.unknown("No HTTPURLResponse") }
        let status = http.statusCode

        // Try decode `{ error: string }`
        
        if !(200...299).contains(status) {
            let msg = (try? JSONDecoder().decode(ErrorBox.self, from: data).error)
                      ?? String(data: data, encoding: .utf8)
            switch status {
            case 401: throw ApiError.unauthorized(msg)
            case 403: throw ApiError.forbidden(msg)
            case 404: throw ApiError.notFound(msg)
            case 422: throw ApiError.validation(msg)
            case 429:
                let retryAfter = http.value(forHTTPHeaderField: "Retry-After").flatMap { TimeInterval($0) }
                throw ApiError.rateLimited(retryAfter: retryAfter)
            case 500...599: throw ApiError.server(msg)
            default: throw ApiError.unknown(msg)
            }
        }

        // Decode success
        if Response.self == EmptyResponse.self {
            return EmptyResponse() as! Response
        }
        do {
            let decoder = JSONDecoder()
            return try decoder.decode(Response.self, from: data)
        } catch {
            if data.isEmpty { throw ApiError.decoding("Empty body") }
            throw ApiError.decoding(String(describing: error))
        }
    }
}
