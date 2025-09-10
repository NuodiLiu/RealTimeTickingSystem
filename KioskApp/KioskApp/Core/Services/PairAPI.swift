//
//  PairAPI.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation


final class PairAPI {
    private let client: ApiClient
    init(client: ApiClient) { self.client = client }
    
    func completePairing(pairingToken: String, mode: DeviceMode?) async throws -> PairCompleteResponse {
        let ep = Endpoint<PairCompleteResponse>(
            path: "/pair/complete",
            method: .POST,
            needsDeviceAuth: false
        )
        let req = PairCompleteRequest(pairingToken: pairingToken, mode: mode?.rawValue)
        return try await client.request(ep, body: req)
    }
}
