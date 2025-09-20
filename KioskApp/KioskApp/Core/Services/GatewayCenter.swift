//
//  GatewayCenter.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation
import Combine

final class GatewayCenter: ObservableObject, DeviceGatewayDelegate {
    @Published var isConnected: Bool = false
    @Published var showFeedback: FeedbackShowPayload?
    @Published var lockAssigned: LockAssignedPayload?
    @Published var modeChanged: DeviceMode?
    @Published var deviceUnpaired: Bool = false
    
    // Keep references to both services for smooth transition
    weak var socketService: SocketService?
    weak var signalRService: SignalRService?
    
    // Helper properties for connection status
    var isSocketConnected: Bool { socketService?.isConnected ?? false }
    var isSignalRConnected: Bool { signalRService?.isConnected ?? false }
    
    // Updated connection status based on which service is active
    private func updateConnectionStatus() {
        // Prefer SignalR if available, fallback to WebSocket
        let wasConnected = isConnected
        isConnected = isSignalRConnected || isSocketConnected
        
        if wasConnected != isConnected {
            print("GatewayCenter: Connection status changed - SignalR: \(isSignalRConnected), WebSocket: \(isSocketConnected), Overall: \(isConnected)")
        }
    }

    func gatewayDidConnect() { 
        updateConnectionStatus()
    }
    func gatewayDidDisconnect() { 
        updateConnectionStatus()
    }

    func gatewayShowFeedback(_ payload: FeedbackShowPayload, raw: [String : Any]) {
        print("GatewayCenter: gatewayShowFeedback called")
        print("GatewayCenter: Payload: \(payload)")
        print("GatewayCenter: Setting showFeedback = payload")
        showFeedback = payload
    }

    func gatewayDismiss() {
        showFeedback = nil
    }

    func gatewayLockAssigned(_ payload: LockAssignedPayload, raw: [String : Any]) {
        lockAssigned = payload
    }

    func gatewayModeChanged(_ mode: DeviceMode) {
        modeChanged = mode
    }
    
    func gatewayDeviceUnpaired() {
        print("GatewayCenter: Device unpaired by server - setting deviceUnpaired = true")
        deviceUnpaired = true
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            print("GatewayCenter: Resetting deviceUnpaired flag")
            self.deviceUnpaired = false
        }
    }
}
