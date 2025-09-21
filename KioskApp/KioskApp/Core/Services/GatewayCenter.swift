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
    
    // Keep reference to SignalR service
    weak var signalRService: SignalRService?
    
    // Helper property for connection status
    var isSignalRConnected: Bool { signalRService?.isConnected ?? false }
    
    // Updated connection status
    private func updateConnectionStatus() {
        let wasConnected = isConnected
        isConnected = isSignalRConnected
        
        if wasConnected != isConnected {
            print("GatewayCenter: Connection status changed - SignalR: \(isSignalRConnected), Overall: \(isConnected)")
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
        print("GatewayCenter: Current thread: \(Thread.isMainThread ? "main" : "background")")
        
        // Ensure UI updates happen immediately on main thread
        DispatchQueue.main.async {
            print("GatewayCenter: Setting deviceUnpaired = true on main thread")
            self.deviceUnpaired = true
            
            // Reset the flag after a short delay to allow RootViewModel to process the event
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                print("GatewayCenter: Resetting deviceUnpaired flag")
                self.deviceUnpaired = false
            }
        }
    }
}
