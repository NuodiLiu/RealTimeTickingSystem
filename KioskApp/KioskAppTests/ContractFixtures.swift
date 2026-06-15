//
//  ContractFixtures.swift
//  KioskAppTests
//
//  Loads the canonical SignalR message fixtures from `contracts/signalr/` at the
//  repo root — the single source of truth shared with the backend. The backend
//  validates the same files from the producer side; see contracts/signalr/README.md.
//

import Foundation
@testable import KioskApp

enum ContractFixtures {

    /// `contracts/signalr/`, resolved relative to this source file so it works
    /// regardless of checkout location. The iOS Simulator can read host paths.
    private static let signalRDir: URL = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()   // KioskAppTests/
        .deletingLastPathComponent()   // KioskApp/
        .deletingLastPathComponent()   // <repo root>/
        .appendingPathComponent("contracts/signalr")

    /// All server-to-device fixture base names.
    static let serverToDeviceNames = [
        "show-feedback", "dismiss", "mode-changed", "unpaired", "lock-assigned", "ping",
    ]

    /// Raw bytes of a `server-to-device` fixture.
    static func serverToDeviceData(_ name: String) throws -> Data {
        let url = signalRDir
            .appendingPathComponent("server-to-device")
            .appendingPathComponent("\(name).json")
        return try Data(contentsOf: url)
    }

    /// A `server-to-device` fixture decoded into the app's wire model.
    static func serverToDevice(_ name: String) throws -> ServerEnvelope {
        try JSONDecoder().decode(ServerEnvelope.self, from: serverToDeviceData(name))
    }
}
