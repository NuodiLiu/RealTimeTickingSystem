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
    
    
    func createCase(zID: String?, name: String, categoryId: String) async throws -> CreateCaseResponse {
        let ep = Endpoint<CreateCaseResponse>(
            path: "/cases",
            method: .POST,
            needsDeviceAuth: true
        )
        let body = CreateCaseRequest(zID: zID, name: name, categoryId: categoryId)

        print("CreateCase Request - zID: '\(zID ?? "nil")', studentName: '\(name)', category: '\(categoryId)'")

        return try await client.request(ep, body: body)
    }
}
