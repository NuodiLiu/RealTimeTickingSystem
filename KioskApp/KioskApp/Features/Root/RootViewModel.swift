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

    private func routeFor(_ mode: DeviceMode) -> RootRoute {
        switch mode {
        case .REGISTRATION: return .register
        case .FEEDBACK:     return .feedback
        case .DUAL:         return .register   // 你可以改成 feedback；这里只能二选一
        }
    }
}
