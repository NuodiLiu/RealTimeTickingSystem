//
//  FeedbackAPI.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation


final class FeedbackAPI {
    private let client: ApiClient
    init(client: ApiClient) { self.client = client }
    
    
    /// 设备提交反馈 — POST /feedback/submit （requireDevice）
    func submit(sessionId: String, rating: Int, text: String?) async throws {
        let ep = Endpoint<EmptyResponse>(
            path: "/feedback/submit",
            method: .POST,
            needsDeviceAuth: true
        )
        let body = SubmitFeedbackRequest(sessionId: sessionId, rating: rating, text: text)
        _ = try await client.request(ep, body: body)
    }
}
