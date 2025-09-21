//
//  DevResetGesture.swift
//  KioskApp
//


import SwiftUI

/// rapid reset tap 5x 
struct DevResetGesture: ViewModifier {
    @State private var tapCount = 0
    @State private var showResetAlert = false
    @State private var lastTapTime = Date()
    
    func body(content: Content) -> some View {
        content
            .overlay(
                VStack {
                    HStack {
                        Spacer()
                        Rectangle()
                            .fill(Color.red.opacity(0.1)) 
                            .frame(width: 120, height: 120) 
                            .scaleEffect(tapCount > 0 ? 1.1 : 1.0)
                            .animation(.easeInOut(duration: 0.1), value: tapCount)
                            .highPriorityGesture(
                                TapGesture()
                                    .onEnded { _ in
                                        let now = Date()
                                        print("Dev Reset: HIGH PRIORITY Tap detected at \(now)")
                                        
                                        if now.timeIntervalSince(lastTapTime) > 2.0 {
                                            print("Dev Reset: Time gap > 2s, resetting count")
                                            tapCount = 0
                                        }
                                        
                                        tapCount += 1
                                        lastTapTime = now
                                        
                                        let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                                        impactFeedback.impactOccurred()
                                        
                                        print("Dev Reset: Tap \(tapCount)/5 at \(now)")
                                        
                                        if tapCount >= 5 {
                                            print("Dev Reset: *** TRIGGERED! *** Showing alert")
                                            showResetAlert = true
                                            tapCount = 0
                                            
                                            let successFeedback = UIImpactFeedbackGenerator(style: .heavy)
                                            successFeedback.impactOccurred()
                                        } else {
                                            let currentTapTime = now
                                            DispatchQueue.main.asyncAfter(deadline: .now() + 2.1) {
                                                if abs(currentTapTime.timeIntervalSince(self.lastTapTime)) < 0.1 {
                                                    print("Dev Reset: Auto-reset count after 2s")
                                                    self.tapCount = 0
                                                }
                                            }
                                        }
                                    }
                            )
                    }
                    Spacer()
                }
                .allowsHitTesting(true)
            )
            .alert("Reset Device", isPresented: $showResetAlert) {
                Button("Cancel", role: .cancel) { }
                Button("Reset", role: .destructive) {
                    performDeviceReset()
                }
            } message: {
                Text("This will unpair the device and return to the pairing screen. Are you sure?")
            }
    }
    
    private func performDeviceReset() {
        Task { @MainActor in
            let appEnv = AppEnvironment.shared
            do {
                try appEnv.authProvider.clearDevice()
                appEnv.modeStore.clear()
                appEnv.signalRService.disconnect()
                print("Dev reset completed - device unpaired")
                
                NotificationCenter.default.post(name: .deviceResetRequested, object: nil)
            } catch {
                print("Dev reset failed: \(error)")
            }
        }
    }
}

extension Notification.Name {
    static let deviceResetRequested = Notification.Name("deviceResetRequested")
}

extension View {
    func devResetGesture() -> some View {
        modifier(DevResetGesture())
    }
}