import SwiftUI

struct RootView: View {
    @ObservedObject var vm: RootViewModel

    var body: some View {
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
                        if p != nil { vm.route = .feedback }
                    }
            case .feedback:
                if let caseId = vm.pendingFeedback?.caseId {
                    FeedbackView(vm: FeedbackViewModel(env: vm.env, caseId: caseId)) {
                        vm.backToModePage()
                    }
                } else {
                    FeedbackView(vm: FeedbackViewModel(env: vm.env, caseId: "N/A")) {
                        vm.backToModePage()
                    }
                }
            }
        }
    }
}
