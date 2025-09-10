//
//  PairAPI.swift
//  KioskApp
//
//  Created by liunuodi on 9/9/2025.
//

import Foundation
import UIKit


final class PairAPI {
    private let client: ApiClient
    init(client: ApiClient) { self.client = client }
    
    func completePairing(pairingToken: String, mode: DeviceMode?) async throws -> PairCompleteResponse {
        let ep = Endpoint<PairCompleteResponse>(
            path: "/pair/complete",
            method: .POST,
            needsDeviceAuth: false
        )
        let deviceName = await UIDevice.current.name
        let req = PairCompleteRequest(
            pairingToken: pairingToken, 
            deviceName: deviceName,
            mode: mode?.rawValue
        )
        return try await client.request(ep, body: req)
    }
}
