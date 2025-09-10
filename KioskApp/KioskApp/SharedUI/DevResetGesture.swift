//
//  DevResetGesture.swift
//  KioskApp
//
//  Created by AI Assistant on 10/9/2025.
//

import SwiftUI

/// 开发者重置手势 - 在屏幕右上角快速点击5次触发设备重置
struct DevResetGesture: ViewModifier {
    @State private var tapCount = 0
    @State private var showResetAlert = false
    @State private var lastTapTime = Date()
    
    func body(content: Content) -> some View {
        content
            .overlay(
                // 右上角隐藏的重置区域
                VStack {
                    HStack {
                        Spacer()
                        Rectangle()
                            .fill(Color.red.opacity(0.1)) // 轻微可见，便于调试
                            .frame(width: 120, height: 120) // 更大的触发区域
                            .scaleEffect(tapCount > 0 ? 1.1 : 1.0)
                            .animation(.easeInOut(duration: 0.1), value: tapCount)
                            .highPriorityGesture(
                                // 使用高优先级确保不被拖动阻断器干扰
                                TapGesture()
                                    .onEnded { _ in
                                        let now = Date()
                                        print("🔧 Dev Reset: HIGH PRIORITY Tap detected at \(now)")
                                        
                                        // 如果距离上次点击超过2秒，重置计数
                                        if now.timeIntervalSince(lastTapTime) > 2.0 {
                                            print("🔧 Dev Reset: Time gap > 2s, resetting count")
                                            tapCount = 0
                                        }
                                        
                                        tapCount += 1
                                        lastTapTime = now
                                        
                                        // 触觉反馈
                                        let impactFeedback = UIImpactFeedbackGenerator(style: .light)
                                        impactFeedback.impactOccurred()
                                        
                                        print("🔧 Dev Reset: Tap \(tapCount)/5 at \(now)")
                                        
                                        if tapCount >= 5 {
                                            print("🔧 Dev Reset: *** TRIGGERED! *** Showing alert")
                                            showResetAlert = true
                                            tapCount = 0
                                            
                                            // 成功触发的强烈反馈
                                            let successFeedback = UIImpactFeedbackGenerator(style: .heavy)
                                            successFeedback.impactOccurred()
                                        } else {
                                            // 2秒后自动重置计数（只在未达到5次时）
                                            let currentTapTime = now
                                            DispatchQueue.main.asyncAfter(deadline: .now() + 2.1) {
                                                if abs(currentTapTime.timeIntervalSince(self.lastTapTime)) < 0.1 {
                                                    // 如果这是最后一次点击，重置计数
                                                    print("🔧 Dev Reset: Auto-reset count after 2s")
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
        let appEnv = AppEnvironment.shared
        do {
            try appEnv.authProvider.clearDevice()
            appEnv.modeStore.clear()
            appEnv.socketService.disconnect()
            print("🔧 Dev reset completed - device unpaired")
            
            // 发送重置通知，让 RootViewModel 更新状态
            NotificationCenter.default.post(name: .deviceResetRequested, object: nil)
        } catch {
            print("❌ Dev reset failed: \(error)")
        }
    }
}

extension Notification.Name {
    static let deviceResetRequested = Notification.Name("deviceResetRequested")
}

extension View {
    /// 添加开发者重置手势到视图
    func devResetGesture() -> some View {
        modifier(DevResetGesture())
    }
}