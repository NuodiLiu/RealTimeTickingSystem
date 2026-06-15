//
//  GatewayCenterTests.swift
//  KioskAppTests
//
//  Integration + contract tests for the SignalR-envelope intake seam.
//
//  Boundary: these tests cover everything from `GatewayCenter.signalRReceived`
//  downward — payload decoding and the resulting `@Published` events. The real
//  SignalR transport (Azure connection, JWT, reconnection) is NOT exercised.
//
//  The "consumes ... fixture" tests feed the canonical contract fixtures from
//  `contracts/signalr/` — the same files the backend validates from the
//  producer side. A field renamed on either side breaks that side's test.
//  See contracts/signalr/README.md.
//

import Foundation
import Testing
@testable import KioskApp

@MainActor
struct GatewayCenterTests {

    /// Fresh, isolated GatewayCenter for each test.
    private func makeGateway() -> GatewayCenter {
        AppEnvironment.makeForTesting().gatewayCenter
    }

    /// Decode a server envelope from inline JSON (used for malformed-input tests).
    private func envelope(_ json: String) throws -> ServerEnvelope {
        try JSONDecoder().decode(ServerEnvelope.self, from: Data(json.utf8))
    }

    // MARK: - Contract: every fixture is consumable

    @Test func everyServerToDeviceFixtureDecodes() throws {
        for name in ContractFixtures.serverToDeviceNames {
            _ = try ContractFixtures.serverToDevice(name)
        }
    }

    // MARK: - Contract: each fixture drives the right event

    @Test func consumesShowFeedbackFixture() throws {
        let gw = makeGateway()
        gw.signalRReceived(try ContractFixtures.serverToDevice("show-feedback"))

        let payload = try #require(gw.showFeedback, "SHOW_FEEDBACK payload failed to decode")
        #expect(!payload.sessionId.isEmpty)
        #expect(!payload.caseId.isEmpty)
        #expect(!payload.staff.id.isEmpty)
    }

    @Test func consumesDismissFixture() throws {
        let gw = makeGateway()
        gw.signalRReceived(try ContractFixtures.serverToDevice("show-feedback"))
        #expect(gw.showFeedback != nil)

        gw.signalRReceived(try ContractFixtures.serverToDevice("dismiss"))
        #expect(gw.showFeedback == nil)
    }

    @Test func consumesModeChangedFixture() throws {
        let gw = makeGateway()
        gw.signalRReceived(try ContractFixtures.serverToDevice("mode-changed"))
        #expect(gw.modeChanged == .FEEDBACK)
    }

    @Test func consumesUnpairedFixture() throws {
        let gw = makeGateway()
        #expect(gw.deviceUnpaired == false)
        gw.signalRReceived(try ContractFixtures.serverToDevice("unpaired"))
        #expect(gw.deviceUnpaired == true)
    }

    @Test func consumesPingFixture() throws {
        let gw = makeGateway()
        gw.signalRReceived(try ContractFixtures.serverToDevice("ping"))
        let ping = try #require(gw.lastPing, "PING payload failed to decode")
        #expect(ping.now != nil)
    }

    @Test func consumesLockAssignedFixture() throws {
        let gw = makeGateway()
        // LOCK_ASSIGNED is a known type the iPad currently ignores — it must
        // decode and trigger no other event.
        gw.signalRReceived(try ContractFixtures.serverToDevice("lock-assigned"))
        #expect(gw.showFeedback == nil)
        #expect(gw.modeChanged == nil)
        #expect(gw.deviceUnpaired == false)
    }

    // MARK: - Robustness: bad input is tolerated (not part of the contract)

    @Test func unknownTypeIsIgnored() throws {
        let gw = makeGateway()
        gw.signalRReceived(try envelope(#"{"type":"SOMETHING_NEW","payload":{"x":1}}"#))
        #expect(gw.showFeedback == nil)
        #expect(gw.modeChanged == nil)
        #expect(gw.deviceUnpaired == false)
    }

    @Test func malformedShowFeedbackPayloadIsIgnored() throws {
        let gw = makeGateway()
        // Missing caseId / staff / expireAt — decoding fails, event must not fire.
        gw.signalRReceived(try envelope(#"{"type":"SHOW_FEEDBACK","payload":{"sessionId":"s1"}}"#))
        #expect(gw.showFeedback == nil)
    }
}
