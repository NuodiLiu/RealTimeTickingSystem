//
//  FeedbackViewModel.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation
import Combine

/// for submititng rating + comment, return delivered upon receiving feedback
final class FeedbackViewModel: ObservableObject {
    @Published var rating: Int = 0                
    @Published var text: String = ""                

    @Published private(set) var isSubmitting = false
    @Published private(set) var submitted = false
    @Published var errorMessage: String?

    private let caseId: String
    /// if payload originates from show_feedback, can include sessionId for delivered
    private let pendingPayload: FeedbackShowPayload?
    private let env: AppEnvironment

    private var bag = Set<AnyCancellable>()

    /// - Parameters:
    ///   - env: dependent environment
    ///   - caseId: id for submitting feedback
    ///   - payload: original payload (used for ACK / DELIVERED when the view appears)
    init(env: AppEnvironment, caseId: String, payload: FeedbackShowPayload? = nil) {
        self.env = env
        self.caseId = caseId
        self.pendingPayload = payload
    }

    // MARK: - Lifecycle Hooks
    /// Called when the view appears: ACK upstream, report status heartbeat, etc.
    func onAppear() {
        if let payload = pendingPayload {
            env.socketService.sendDelivered(sessionId: payload.sessionId)
        }
        env.socketService.sendStatusPing()
    }

    // MARK: - Validation
    var canSubmit: Bool {
        (1...5).contains(rating) && !isSubmitting && !submitted
    }

    // MARK: - Submission
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
            env.socketService.sendStatusPing()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
    
    // MARK: - cancel
    func cancel() {
        guard let sessionId = pendingPayload?.sessionId else {
            print("FeedbackViewModel: No sessionId to cancel")
            return
        }

        print("FeedbackViewModel: Sending FEEDBACK_CANCELLED for session \(sessionId)")
        env.socketService.sendFeedbackCancelled(sessionId: sessionId)
    }
}
