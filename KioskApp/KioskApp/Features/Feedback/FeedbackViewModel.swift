//
//  FeedbackViewModel.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation
import Combine

/// 负责五星评分 + 可选文本的提交；并在收到 SHOW_FEEDBACK 时回 DELIVERED
final class FeedbackViewModel: ObservableObject {
    // 输入
    @Published var rating: Int = 0                  // 1...5
    @Published var text: String = ""                // 可选

    // 状态
    @Published private(set) var isSubmitting = false
    @Published private(set) var submitted = false
    @Published var errorMessage: String?

    /// 当前反馈绑定的 Case
    private let caseId: String
    /// 若来自 SHOW_FEEDBACK 的 payload，可能附带 sessionId 用于 DELIVERED
    private let pendingPayload: FeedbackShowPayload?
    private let env: AppEnvironment

    private var bag = Set<AnyCancellable>()

    /// - Parameters:
    ///   - env: 依赖的环境
    ///   - caseId: 要提交反馈的 caseId（SHOW_FEEDBACK 里会给）
    ///   - payload: 原始 payload（用于在视图出现时 ACK /DELIVERED）
    init(env: AppEnvironment, caseId: String, payload: FeedbackShowPayload? = nil) {
        self.env = env
        self.caseId = caseId
        self.pendingPayload = payload
    }

    // MARK: - 生命周期钩子
    /// 视图出现时调用：上行 ACK、上报状态心跳等
    func onAppear() {
        if let payload = pendingPayload {
            env.socketService.sendDelivered(sessionId: payload.sessionId)
        }
        env.socketService.sendStatusPing()
    }

    // MARK: - 校验
    var canSubmit: Bool {
        (1...5).contains(rating) && !isSubmitting && !submitted
    }

    // MARK: - 提交
    @MainActor
    func submit() async {
        guard canSubmit else {
            errorMessage = rating == 0 ? "Please Rate" : nil
            return
        }
        
        guard let sessionId = pendingPayload?.sessionId else {
            errorMessage = "No active feedback session"
            return
        }
        
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        do {
            try await env.feedbackAPI.submit(
                sessionId: sessionId,
                rating: rating,
                text: text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : text
            )
            submitted = true
            // 可选：提交后发一个状态消息给后端
            env.socketService.sendStatusPing()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
    
    // MARK: - 取消
    func cancel() {
        guard let sessionId = pendingPayload?.sessionId else {
            print("📱 FeedbackViewModel: No sessionId to cancel")
            return
        }
        
        print("📱 FeedbackViewModel: Sending FEEDBACK_CANCELLED for session \(sessionId)")
        env.socketService.sendFeedbackCancelled(sessionId: sessionId)
    }
}
