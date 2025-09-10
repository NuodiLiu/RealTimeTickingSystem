//
//  CaseAPI.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation


final class CasesAPI {
    private let client: ApiClient
    init(client: ApiClient) { self.client = client }
    
    
    /// 创建设备端 Case（登记） — POST /cases （requireDevice）
    func createCase(name: String, categoryId: String) async throws -> CreateCaseResponse {
        let ep = Endpoint<CreateCaseResponse>(
            path: "/cases",
            method: .POST,
            needsDeviceAuth: true
        )
        let body = CreateCaseRequest(name: name, categoryId: categoryId)
        return try await client.request(ep, body: body)
    }
}
