//
//  HeartbeatManager.swift
//  KioskApp
//
//  Manages periodic heartbeat reporting to backend
//  
//  Architecture:
//  - iPad sends HTTP heartbeat every 45s (within 30-60s design range)
//  - Backend marks device offline if no heartbeat for 2 minutes (120s)
//  - Backend zombie detection runs every 90s
//

import Foundation
import Combine

/// Response from POST /device/heartbeat
struct HeartbeatResponse: Decodable {
    let success: Bool
    let status: String  // "IDLE" or "BUSY"
    let deviceMode: String
    let timestamp: String
    let currentLock: CurrentLockInfo?
    
    struct CurrentLockInfo: Decodable {
        let id: String
        let status: String
        let `case`: CaseInfo
        let staffName: String
        let leaseExpireAt: String
        
        struct CaseInfo: Decodable {
            let id: String
            let studentName: String
            let category: String
            let status: String
        }
    }
}

/// Manages periodic heartbeat reporting to keep device status updated
final class HeartbeatManager: ObservableObject {
    // MARK: - Properties
    
    private let apiClient: ApiClient
    private var timer: Timer?
    private let interval: TimeInterval = 45.0  // 45 seconds (within 30-60s range)
    
    @Published private(set) var isRunning = false
    @Published private(set) var lastHeartbeatTime: Date?
    @Published private(set) var lastStatus: String?
    @Published private(set) var consecutiveFailures = 0
    
    private let maxConsecutiveFailures = 5  // Stop trying after 5 failures
    
    // MARK: - Initialization
    
    init(apiClient: ApiClient) {
        self.apiClient = apiClient
    }
    
    // MARK: - Public Methods
    
    /// Start sending periodic heartbeats
    func start() {
        guard !isRunning else {
            print("⚠️ [Heartbeat] Already running")
            return
        }
        
        print("💓 [Heartbeat] Starting periodic heartbeat (every \(Int(interval))s)")
        isRunning = true
        consecutiveFailures = 0
        
        // Send first heartbeat immediately
        Task { await sendHeartbeat() }
        
        // Schedule periodic heartbeats
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            Task { await self?.sendHeartbeat() }
        }
    }
    
    /// Stop sending heartbeats
    func stop() {
        guard isRunning else { return }
        
        print("🛑 [Heartbeat] Stopping periodic heartbeat")
        timer?.invalidate()
        timer = nil
        isRunning = false
    }
    
    /// Send a single heartbeat immediately (useful for manual triggers)
    func sendNow() {
        Task { await sendHeartbeat() }
    }
    
    // MARK: - Private Methods
    
    private func sendHeartbeat() async {
        // Check if we should stop due to too many failures
        guard consecutiveFailures < maxConsecutiveFailures else {
            print("❌ [Heartbeat] Too many consecutive failures (\(consecutiveFailures)), stopping")
            await MainActor.run { stop() }
            return
        }
        
        do {
            let endpoint = Endpoint<HeartbeatResponse>(
                path: "/device/heartbeat",
                method: .POST,
                needsDeviceAuth: true
            )
            
            let response = try await apiClient.request(endpoint, body: EmptyResponse())
            
            await MainActor.run {
                lastHeartbeatTime = Date()
                lastStatus = response.status
                consecutiveFailures = 0
            }
            
            print("✅ [Heartbeat] Success: status=\(response.status), mode=\(response.deviceMode)")
            
            // If device is BUSY, we could notify the app to update UI
            if response.status == "BUSY", let lock = response.currentLock {
                print("📋 [Heartbeat] Device is BUSY with case: \(lock.case.studentName)")
            }
            
        } catch ApiError.unauthorized(let msg) {
            print("🔐 [Heartbeat] Unauthorized: \(msg ?? "unknown") - device credentials may be invalid")
            await MainActor.run {
                consecutiveFailures += 1
            }
            
        } catch ApiError.network(let urlError) {
            print("🌐 [Heartbeat] Network error: \(urlError.localizedDescription)")
            await MainActor.run {
                consecutiveFailures += 1
            }
            
        } catch {
            print("❌ [Heartbeat] Failed: \(error.localizedDescription)")
            await MainActor.run {
                consecutiveFailures += 1
            }
        }
    }
    
    deinit {
        stop()
    }
}
