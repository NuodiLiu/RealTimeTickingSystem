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
                print("📱 RootViewModel: showFeedback changed to: \(p?.description ?? "nil")")
                print("📱 RootViewModel: Current mode is: \(self.currentMode.rawValue)")
                print("📱 RootViewModel: Current route is: \(self.route)")
                
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
                print("📱 RootViewModel: deviceUnpaired changed to: \(isUnpaired)")
                if isUnpaired {
                    print("📱 RootViewModel: *** SERVER UNPAIR TRIGGERED *** Processing server unpair event")
                    self?.handleServerUnpair()
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
            print("📱 RootViewModel: WS Token exists: \(env.authProvider.wsToken?.prefix(20) ?? "nil")...")
            
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
        env.socketService.delegate = env.gatewayCenter
        env.socketService.connect()
        
        // 监听应用生命周期来处理连接状态
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.handleAppBecameActive()
        }
    }
    
    private func handleAppBecameActive() {
        // 当应用重新激活时，检查连接状态
        if isPaired && !env.socketService.isConnected {
            print("📱 RootViewModel: App became active, reconnecting socket...")
            env.socketService.reconnect()
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
            env.socketService.disconnect()
            
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
        print("📱 *** HANDLING SERVER UNPAIR EVENT ***")
        print("📱 Current state - isPaired: \(isPaired), mode: \(currentMode), route: \(route)")
        
        do {
            try env.authProvider.clearDevice()
            env.modeStore.clear()
            env.socketService.disconnect()
            
            // 重置状态，返回配对界面
            isPaired = false
            currentMode = .REGISTRATION
            route = .register
            
            print("📱 After server unpair - isPaired: \(isPaired), mode: \(currentMode), route: \(route)")
            print("✅ Successfully handled server unpair - returning to pairing screen")
        } catch {
            print("❌ Failed to handle server unpair: \(error)")
        }
    }

    private func routeFor(_ mode: DeviceMode) -> RootRoute {
        switch mode {
        case .REGISTRATION: return .register
        case .FEEDBACK:     return .feedback
        }
    }
}
