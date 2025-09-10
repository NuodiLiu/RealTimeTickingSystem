//
//  PairingViewModel.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation
import Combine
import AVFoundation

/// 首次进入/未配对时的 VM：选择 mode -> 扫码 -> 调用 /pair/complete
final class PairingViewModel: ObservableObject {
    @Published var selectedMode: DeviceMode = .REGISTRATION
    @Published var isScanning = false
    @Published var isPairing = false
    @Published var errorMessage: String?

    private let env: AppEnvironment
    private let modeStore: DeviceModeStore
    private let onPaired: (DeviceMode?) -> Void

    init(env: AppEnvironment,
         modeStore: DeviceModeStore,
         onPaired: @escaping (DeviceMode?) -> Void) {
        self.env = env
        self.modeStore = modeStore
        self.onPaired = onPaired
    }
    
    func startScan() {
        // 检查相机权限（最简版本）
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: isScanning = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] ok in
                DispatchQueue.main.async { if ok { self?.isScanning = true } else { self?.errorMessage = "Camera access denied" } }
            }
        default:
            errorMessage = "Camera access denied"
        }
    }
    
    /// 扫码拿到 token 后调用
    @MainActor
    func handleScanned(token: String) async {
        isScanning = false
        try? await Task.sleep(nanoseconds: 150_000_000)
        await pair(with: token)
    }
    
    @MainActor
    private func pair(with token: String) async {
        guard !isPairing else { return }
        isPairing = true
        errorMessage = nil
        defer { isPairing = false }
        
        do {
            struct EPResp: Decodable {
                let deviceId: String
                let apiKey: String
                let mode: DeviceMode?
            }
            let ep = Endpoint<EPResp>(path: "/pair/complete", method: .POST, needsDeviceAuth: false)
            let body = PairCompleteRequest(pairingToken: token, mode: selectedMode.rawValue)
            
            let resp: EPResp = try await env.apiClient.request(ep, body: body)
            
            let finalMode = resp.mode ?? selectedMode
            let creds = DeviceCredentials(deviceId: resp.deviceId, apiKey: resp.apiKey, mode: finalMode)
            try env.authProvider.storeDevice(credentials: creds)
            print("Stored device, id:", creds.deviceId.prefix(6), "mode:", creds.mode.rawValue)
            
            modeStore.save(finalMode)
            
            onPaired(finalMode)
            
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
