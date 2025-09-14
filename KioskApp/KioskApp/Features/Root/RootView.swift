import SwiftUI

struct RootView: View {
    @ObservedObject var vm: RootViewModel

    var body: some View {
        ZStack {
            if !vm.isPaired {
                // 未配对：模式选择 + 扫码
                PairingView(env: vm.env, modeStore: vm.env.modeStore) { mode in
                    vm.onPairedSuccessfully(mode: mode)
                }
            } else {
                // 已配对：根据 route 展示业务页
                switch vm.route {
                case .register:
                    RegistrationView(vm: RegistrationViewModel(env: vm.env))
                        .onReceive(vm.env.gatewayCenter.$showFeedback) { p in
                            // 只有在FEEDBACK模式下才允许切换到feedback路由
                            if p != nil && vm.currentMode == .FEEDBACK {
                                print("📱 RootView: Switching to feedback route (device mode: \(vm.currentMode.rawValue))")
                                vm.route = .feedback
                            } else if p != nil {
                                print("📱 RootView: Ignoring showFeedback because device mode is \(vm.currentMode.rawValue), not FEEDBACK")
                            }
                        }
                case .feedback:
                    if let payload = vm.pendingFeedback {
                        FeedbackView(vm: FeedbackViewModel(env: vm.env, caseId: payload.caseId, payload: payload)) {
                            vm.backToModePage()
                        }
                    } else {
                        FeedbackCoverView()
                    }
                }
            }
            
            // 只有在配对状态下添加重置手势覆盖层
            if vm.isPaired {
                Color.clear
                    // .devResetGesture() // 添加统一的开发者重置手势 - DISABLED
            }
        }// 禁用拖动手势
        .allowsHitTesting(true)
    }
}
