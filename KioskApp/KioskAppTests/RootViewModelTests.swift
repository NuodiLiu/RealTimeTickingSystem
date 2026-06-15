//
//  RootViewModelTests.swift
//  KioskAppTests
//
//  Integration tests for the post-pairing state machine.
//
//  Boundary: these tests drive `GatewayCenter` events and assert that
//  `RootViewModel` updates `route` / `isPaired` / `currentMode` /
//  `pendingFeedback` correctly. They cover the logic *between* the SignalR
//  intake and the SwiftUI layer — the screens themselves are covered by the
//  XCUITest smoke suite, not here.
//

import Foundation
import Testing
@testable import KioskApp

@MainActor
struct RootViewModelTests {

    /// RootViewModel's Combine sinks deliver on the main queue, so a test must
    /// yield the main actor before asserting. `handleServerUnpair` adds a
    /// second main-queue hop, hence the generous delay.
    private func flush() async {
        try? await Task.sleep(for: .milliseconds(100))
    }

    private func feedbackPayload() -> FeedbackShowPayload {
        FeedbackShowPayload(
            sessionId: "s1",
            caseId: "c1",
            staff: StaffInfo(id: "st1", name: "Alice"),
            expireAt: "2030-01-01T00:00:00Z"
        )
    }

    @Test func startsUnpairedWithNoCredentials() {
        let env = AppEnvironment.makeForTesting()
        let vm = RootViewModel(env: env)
        #expect(vm.isPaired == false)
        #expect(vm.route == .register)
    }

    @Test func modeChangedToFeedbackSwitchesRoute() async {
        let env = AppEnvironment.makeForTesting()
        let vm = RootViewModel(env: env)
        #expect(vm.route == .register)

        env.gatewayCenter.modeChanged = .FEEDBACK
        await flush()

        #expect(vm.currentMode == .FEEDBACK)
        #expect(vm.route == .feedback)
    }

    @Test func modeChangedBackToRegistrationSwitchesRoute() async {
        let env = AppEnvironment.makeForTesting()
        let vm = RootViewModel(env: env)

        env.gatewayCenter.modeChanged = .FEEDBACK
        await flush()
        env.gatewayCenter.modeChanged = .REGISTRATION
        await flush()

        #expect(vm.currentMode == .REGISTRATION)
        #expect(vm.route == .register)
    }

    @Test func showFeedbackIsIgnoredInRegistrationMode() async {
        let env = AppEnvironment.makeForTesting()
        let vm = RootViewModel(env: env)   // defaults to REGISTRATION

        env.gatewayCenter.showFeedback = feedbackPayload()
        await flush()

        // The event is recorded, but the route must not switch in REGISTRATION.
        #expect(vm.pendingFeedback != nil)
        #expect(vm.route == .register)
    }

    @Test func showFeedbackSwitchesRouteInFeedbackMode() async {
        let env = AppEnvironment.makeForTesting()
        let vm = RootViewModel(env: env)

        env.gatewayCenter.modeChanged = .FEEDBACK
        await flush()
        env.gatewayCenter.showFeedback = feedbackPayload()
        await flush()

        #expect(vm.route == .feedback)
        #expect(vm.pendingFeedback?.caseId == "c1")
    }

    @Test func serverUnpairResetsStateAndClearsCredentials() async {
        let env = AppEnvironment.makeForTesting()
        try? env.authProvider.storeDevice(credentials: DeviceCredentials(
            deviceId: "d1", apiKey: "d1:secret", mode: .REGISTRATION))
        env.modeStore.save(.REGISTRATION)

        let vm = RootViewModel(env: env)
        #expect(vm.isPaired == true)

        env.gatewayCenter.deviceUnpaired = true
        await flush()

        #expect(vm.isPaired == false)
        #expect(vm.route == .register)
        #expect(env.authProvider.deviceApiKey == nil)
    }
}
