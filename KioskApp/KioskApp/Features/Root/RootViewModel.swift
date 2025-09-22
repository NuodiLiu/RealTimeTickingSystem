// Features/Root/RootViewModel.swift
import Foundation
import Combine
import UIKit

enum RootRoute: Hashable { case register, feedback }

final class RootViewModel: ObservableObject {
    @Published var route: RootRoute = .register
    @Published var isPaired: Bool = false
    @Published var currentMode: DeviceMode = .REGISTRATION
    @Published var pendingFeedback: FeedbackShowPayload?

    let env: AppEnvironment
    private var bag = Set<AnyCancellable>()

    init(env: AppEnvironment) {
        self.env = env

        // 绑定服务器事件
        env.gatewayCenter.$modeChanged
            .compactMap { $0 }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] m in
                guard let self else { return }
                print("📱 RootViewModel: modeChanged received: \(m.rawValue)")
                print("📱 RootViewModel: Previous mode was: \(self.currentMode.rawValue)")
                print("📱 RootViewModel: Previous route was: \(self.route)")
                
                self.currentMode = m
                self.env.modeStore.save(m)
                // Clear pending feedback when mode changes
                if m != .FEEDBACK {
                    print("📱 RootViewModel: Clearing pendingFeedback because mode is not FEEDBACK")
                    self.pendingFeedback = nil
                }
                self.route = self.routeFor(m)          // Switch between pages based on mode
                
                print("📱 RootViewModel: After modeChanged - mode: \(self.currentMode.rawValue), route: \(self.route)")
            }.store(in: &bag)

        env.gatewayCenter.$showFeedback
            .receive(on: DispatchQueue.main)
            .sink { [weak self] p in
                guard let self else { return }
                
                self.pendingFeedback = p
                
                // 只有在FEEDBACK模式下才允许切换到feedback路由
                if p != nil && self.currentMode == .FEEDBACK {
                    print("📱 RootViewModel: *** SWITCHING TO FEEDBACK ROUTE *** due to showFeedback (mode: \(self.currentMode.rawValue))")
                    self.route = .feedback
                } else if p != nil {
                    print("📱 RootViewModel: *** IGNORING showFeedback *** because mode is \(self.currentMode.rawValue), not FEEDBACK")
                }
            }.store(in: &bag)

        // 监听服务器发送的 unpair 事件
        env.gatewayCenter.$deviceUnpaired
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isUnpaired in
                print("� [CRITICAL] RootViewModel: *** DEVICE UNPAIRED CHANGED *** to: \(isUnpaired)")
                print("� [CRITICAL] RootViewModel: Current thread: \(Thread.isMainThread ? "main" : "background")")
                print("🚨 [CRITICAL] RootViewModel: Current state - isPaired: \(self?.isPaired ?? false), route: \(self?.route ?? .register)")
                if isUnpaired {
                    print("� [CRITICAL] RootViewModel: *** SERVER UNPAIR TRIGGERED *** Processing server unpair event")
                    self?.handleServerUnpair()
                } else {
                    print("🚨 [CRITICAL] RootViewModel: Device unpaired flag reset to false - no action taken")
                }
            }.store(in: &bag)
        
        // 监听开发者重置请求
        NotificationCenter.default.publisher(for: .deviceResetRequested)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                print("📱 *** NOTIFICATION RECEIVED *** DeviceResetRequested")
                self?.resetPairedStatus()
            }.store(in: &bag)

        if env.authProvider.deviceApiKey != nil {
            print("📱 RootViewModel: Found existing device credentials")
            print("📱 RootViewModel: API Key exists: \(env.authProvider.deviceApiKey?.prefix(20) ?? "nil")...")
            print("📱 RootViewModel: App JWT exists: \(env.authProvider.appJwt?.prefix(20) ?? "nil")...")
            
            isPaired = true
            let stored = env.modeStore.load() ?? .REGISTRATION
            currentMode = stored
            route = routeFor(stored)
            
            print("📱 RootViewModel: Restored mode: \(stored), route: \(route)")
            print("📱 RootViewModel: Attempting to attach socket...")
            
            attachSocket()
        } else {
            print("📱 RootViewModel: No existing device credentials found")
            // 未配对：保持未配对状态
            isPaired = false
            route = .register
        }
    }

    func attachSocket() {
        print("📱 RootViewModel: Attaching socket...")
        
        // 首先检查App JWT是否存在，如果不存在则获取
        Task {
            await ensureAppJWT()
            await MainActor.run {
                env.signalRService.delegate = env.gatewayCenter
                env.signalRService.connect()
            }
        }
        
        // 监听应用生命周期来处理连接状态
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.handleAppBecameActive()
        }
    }
    
    private func ensureAppJWT() async {
        guard env.authProvider.appJwt == nil else {
            print("📱 RootViewModel: App JWT already exists, skipping refresh")
            return
        }
        
        print("📱 RootViewModel: App JWT missing, attempting to obtain...")
        do {
            let jwtResponse = try await env.apiClient.generateDeviceJWT()
            try env.authProvider.storeAppJwt(jwtResponse.appJwt)
            print("📱 RootViewModel: Successfully obtained and stored App JWT")
        } catch {
            print("📱 RootViewModel: Failed to obtain App JWT: \(error)")
        }
    }
    
    private func handleAppBecameActive() {
        // 当应用重新激活时，检查连接状态
        if isPaired && !env.signalRService.isConnected {
            print("📱 RootViewModel: App became active, reconnecting socket...")
            Task {
                await ensureAppJWT()
                await MainActor.run {
                    env.signalRService.reconnect()
                }
            }
        }
    }

    func onPairedSuccessfully(mode: DeviceMode?) {
        print("📱 RootViewModel: onPairedSuccessfully called with mode: \(mode?.rawValue ?? "nil")")
        
        isPaired = true
        let finalMode = mode ?? .REGISTRATION
        currentMode = finalMode
        env.modeStore.save(finalMode)
        route = routeFor(finalMode)
        
        print("📱 RootViewModel: After pairing - isPaired: \(isPaired), mode: \(currentMode.rawValue), route: \(route)")
        print("📱 RootViewModel: About to attach socket...")
        
        attachSocket()
    }

    func backToModePage() {
        // Clear pending feedback to return to cover page
        pendingFeedback = nil
        route = routeFor(currentMode)
    }
    
    // 手动触发的 unpair（目前没有UI）
    func unpairDevice() {
        do {
            try env.authProvider.clearDevice()
            env.modeStore.clear()
            env.signalRService.disconnect()
            
            isPaired = false
            currentMode = .REGISTRATION
            route = .register
            
            print("📱 Device unpaired successfully")
        } catch {
            print("❌ Failed to unpair device: \(error)")
        }
    }
    
    // 手动重置配对状态（用于调试或强制重置）
    func resetPairedStatus() {
        print("📱 *** DEV RESET TRIGGERED *** Manually resetting paired status")
        print("📱 Current state - isPaired: \(isPaired), mode: \(currentMode), route: \(route)")
        
        isPaired = false
        currentMode = .REGISTRATION
        route = .register
        
        print("📱 After reset - isPaired: \(isPaired), mode: \(currentMode), route: \(route)")
    }
    
    // 处理服务器发送的 unpair 事件
    private func handleServerUnpair() {
        print("� [CRITICAL] *** HANDLING SERVER UNPAIR EVENT ***")
        print("� [CRITICAL] Current state - isPaired: \(isPaired), mode: \(currentMode), route: \(route)")
        print("🚨 [CRITICAL] Current thread: \(Thread.isMainThread ? "main" : "background")")
        
        // Ensure all UI updates happen on main thread
        DispatchQueue.main.async { [weak self] in
            guard let self else { 
                print("🚨 [CRITICAL] Self is nil in handleServerUnpair!")
                return 
            }
            
            print("🚨 [CRITICAL] About to clear device credentials...")
            
            do {
                try self.env.authProvider.clearDevice()
                print("🚨 [CRITICAL] Device credentials cleared successfully")
                
                self.env.modeStore.clear()
                print("🚨 [CRITICAL] Mode store cleared")
                
                self.env.signalRService.disconnect()
                print("🚨 [CRITICAL] SignalR service disconnected")
                
                // 重置状态，返回配对界面
                print("🚨 [CRITICAL] BEFORE state change - isPaired: \(self.isPaired), mode: \(self.currentMode), route: \(self.route)")
                
                self.isPaired = false
                self.currentMode = .REGISTRATION
                self.route = .register
                self.pendingFeedback = nil  // Clear any pending feedback
                
                print("� [CRITICAL] AFTER state change - isPaired: \(self.isPaired), mode: \(self.currentMode), route: \(self.route)")
                print("🚨 [CRITICAL] ✅ Successfully handled server unpair - should return to pairing screen")
            } catch {
                print("🚨 [CRITICAL] ❌ Failed to handle server unpair: \(error)")
            }
        }
    }

    private func routeFor(_ mode: DeviceMode) -> RootRoute {
        switch mode {
        case .REGISTRATION: return .register
        case .FEEDBACK:     return .feedback
        }
    }
}
