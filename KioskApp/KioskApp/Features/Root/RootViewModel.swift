// Features/Root/RootViewModel.swift
import Foundation
import Combine

enum RootRoute: Hashable { case register, feedback }

final class RootViewModel: ObservableObject {
    @Published var route: RootRoute = .register
    @Published var isPaired: Bool = false
    @Published var currentMode: DeviceMode = .DUAL
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
                self.currentMode = m
                self.env.modeStore.save(m)
                self.route = self.routeFor(m)          // ← 仅两页之间切换
            }.store(in: &bag)

        env.gatewayCenter.$showFeedback
            .receive(on: DispatchQueue.main)
            .sink { [weak self] p in
                self?.pendingFeedback = p
                if p != nil { self?.route = .feedback } // REGISTRATION 模式下也可被临时覆盖
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
            isPaired = true
            let stored = env.modeStore.load() ?? .DUAL
            currentMode = stored
            route = routeFor(stored)
            attachSocket()
        } else {
            // 未配对：保持未配对状态（不要强行把 route 改到 .register 作为 UI 入口）
            isPaired = false
            // 可选择不改 route，反正 RootView 会先显示 PairingView
            route = .register   // ← 留着也行，但 UI 没用到它；配对完会正确切换
        }
    }

    func attachSocket() {
        env.socketService.delegate = env.gatewayCenter
        env.socketService.connect()
    }

    func onPairedSuccessfully(mode: DeviceMode?) {
        isPaired = true
        let finalMode = mode ?? .DUAL
        currentMode = finalMode
        env.modeStore.save(finalMode)
        route = routeFor(finalMode)
        attachSocket()
    }

    func backToModePage() {
        route = routeFor(currentMode)
    }
    
    // 手动触发的 unpair（目前没有UI）
    func unpairDevice() {
        do {
            try env.authProvider.clearDevice()
            env.modeStore.clear()
            env.socketService.disconnect()
            
            isPaired = false
            currentMode = .DUAL
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
        currentMode = .DUAL
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
            currentMode = .DUAL
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
        case .DUAL:         return .register   // 你可以改成 feedback；这里只能二选一
        }
    }
}
