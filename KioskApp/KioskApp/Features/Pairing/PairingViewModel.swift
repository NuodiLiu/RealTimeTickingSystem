//
//  PairingViewModel.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation
import Combine
import AVFoundation
import UIKit

final class PairingViewModel: ObservableObject {
    @Published var selectedMode: DeviceMode = .REGISTRATION
    @Published var isScanning = false
    @Published var isPairing = false
    @Published var errorMessage: String?
    @Published var cameraPermissionDenied = false

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
    
    func checkCameraPermissionStatus() {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        DispatchQueue.main.async { [weak self] in
            self?.cameraPermissionDenied = (status == .denied || status == .restricted)
        }
    }
    
    func startScan() {
        errorMessage = nil
        
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        
        switch status {
        case .authorized:
            print("Camera authorized, starting scan")
            cameraPermissionDenied = false
            isScanning = true
            
        case .notDetermined:
            print("Requesting camera permission")
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted {
                        print("Camera permission granted")
                        self?.cameraPermissionDenied = false
                        self?.isScanning = true
                    } else {
                        print("Camera permission denied by user")
                        self?.cameraPermissionDenied = true
                        self?.errorMessage = "Camera access is required to scan QR codes"
                    }
                }
            }
            
        case .denied, .restricted:
            print("Camera permission previously denied or restricted")
            cameraPermissionDenied = true
            errorMessage = "Camera access has been denied. Please enable it in Settings to scan QR codes."
            
        @unknown default:
            print("Unknown camera permission status")
            cameraPermissionDenied = true
            errorMessage = "Unable to access camera"
        }
    }
    
    func openCameraSettings() {
        guard let settingsUrl = URL(string: UIApplication.openSettingsURLString),
              UIApplication.shared.canOpenURL(settingsUrl) else {
            errorMessage = "Unable to open Settings"
            return
        }
        
        UIApplication.shared.open(settingsUrl) { [weak self] success in
            if !success {
                DispatchQueue.main.async {
                    self?.errorMessage = "Failed to open Settings"
                }
            }
        }
    }
    
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
        
        print("PairingViewModel: Starting pairing process...")
        print("PairingViewModel: Selected mode: \(selectedMode.rawValue)")
        
        do {
            struct EPResp: Decodable {
                let deviceId: String
                let deviceSecret: String
                let apiKey: String
                let deviceName: String
                let mode: DeviceMode
            }
            let ep = Endpoint<EPResp>(path: "/pair/complete", method: .POST, needsDeviceAuth: false)
            let deviceName = UIDevice.current.name
            let body = PairCompleteRequest(
                pairingToken: token, 
                deviceName: deviceName,
                mode: selectedMode.rawValue
            )
            
            print("   Pairing request:")
            print("   Token: \(token)")
            print("   Device: \(deviceName)")
            print("   Mode: \(selectedMode.rawValue)")
            
            let resp: EPResp = try await env.apiClient.request(ep, body: body)
            
            print("   PairingViewModel: Received response from server:")
            print("   Device ID: \(resp.deviceId)")
            print("   Server returned mode: \(resp.mode.rawValue)")
            
            let finalMode = resp.mode
            print("PairingViewModel: Final mode determined: \(finalMode.rawValue)")
            
            let creds = DeviceCredentials(
                deviceId: resp.deviceId, 
                apiKey: resp.apiKey, 
                mode: finalMode
            )
            
            print("PairingViewModel: About to store device credentials...")
            try env.authProvider.storeDevice(credentials: creds)
            print("Stored device, id:", creds.deviceId.prefix(6), "mode:", creds.mode.rawValue)
            
            // 获取 App JWT
            print("PairingViewModel: Getting App JWT for device...")
            do {
                let jwtResponse = try await env.apiClient.generateDeviceJWT()
                print("PairingViewModel: Successfully obtained App JWT")
                try env.authProvider.storeAppJwt(jwtResponse.appJwt)
                print("PairingViewModel: App JWT stored successfully")
                
                // 主动触发SignalR连接
                print("PairingViewModel: Triggering SignalR connection...")
                env.signalRService.connect()
            } catch {
                print("PairingViewModel: Failed to get App JWT: \(error)")
                // 继续处理，JWT获取失败不应该阻止pairing完成
            }
            
            print("PairingViewModel: About to save mode to store...")
            modeStore.save(finalMode)
            
            print("PairingViewModel: About to call onPaired callback...")
            onPaired(finalMode)
            print("PairingViewModel: onPaired callback completed")
            
        } catch {
            print("PairingViewModel: Pairing failed with error: \(error)")
            errorMessage = error.localizedDescription
        }
    }
}
