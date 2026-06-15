//
//  UITestSupport.swift
//  KioskApp
//
//  Hooks consumed only by XCUITest runs. Everything here is gated behind
//  `#if DEBUG` and only activates when the app is launched with the
//  `-uiTesting` argument, so Release / TestFlight builds are never affected.
//

#if DEBUG
import Foundation

enum UITestSupport {
    private static var args: [String] { ProcessInfo.processInfo.arguments }

    /// True when the app is being driven by the UI test runner.
    static var isUITesting: Bool { args.contains("-uiTesting") }

    /// Apply UI-test launch options. Call once, before `RootViewModel` is built.
    ///
    /// Supported launch arguments:
    /// - `-uiTesting`                       enables this hook + clears stored state
    /// - `-uiTestPaired <REGISTRATION|FEEDBACK>`  seeds fake credentials so the app
    ///                                      launches straight into the business
    ///                                      screen, skipping the pairing flow
    /// - `-uiTestShowFeedback`              seeds a SHOW_FEEDBACK event so the app
    ///                                      launches into the feedback form
    ///                                      (use together with `-uiTestPaired FEEDBACK`)
    /// - `UITEST_REAL_CREDS` env var        JSON ({deviceId, apiKey, mode}) of
    ///                                      backend-issued credentials; overrides
    ///                                      any fake `-uiTestPaired` creds so the
    ///                                      kiosk really authenticates with the
    ///                                      backend (used by the cross-end suite).
    static func applyIfNeeded(env: AppEnvironment) {
        guard isUITesting else { return }

        // Always start each UI test from a clean slate.
        try? env.authProvider.clearDevice()
        env.modeStore.clear()

        // Real backend creds via env take precedence: the cross-end driver
        // calls /auth/test-pair-device, then passes the returned JSON here.
        if let json = ProcessInfo.processInfo.environment["UITEST_REAL_CREDS"],
           let data = json.data(using: .utf8),
           let creds = try? JSONDecoder().decode(DeviceCredentials.self, from: data) {
            try? env.authProvider.storeDevice(credentials: creds)
            env.modeStore.save(creds.mode)
            print("🧪 UITestSupport: seeded REAL backend credentials, deviceId=\(creds.deviceId), mode=\(creds.mode.rawValue)")
        } else if let idx = args.firstIndex(of: "-uiTestPaired"), idx + 1 < args.count {
            // `-uiTestPaired <mode>` injects fake credentials => RootViewModel
            // sees a non-nil deviceApiKey and treats the device as paired, but
            // any network call will fail auth. Used for pure UI-flow checks.
            let mode = DeviceMode(rawValue: args[idx + 1]) ?? .REGISTRATION
            let creds = DeviceCredentials(
                deviceId: "uitest-device",
                apiKey: "uitest-device:uitest-secret",
                mode: mode
            )
            try? env.authProvider.storeDevice(credentials: creds)
            env.modeStore.save(mode)
            print("🧪 UITestSupport: seeded fake paired credentials, mode=\(mode.rawValue)")
        } else {
            print("🧪 UITestSupport: launched unpaired (clean slate)")
        }

        // `-uiTestShowFeedback` seeds a feedback event on the GatewayCenter.
        // RootViewModel subscribes to it during init and replays the current
        // value, so the app boots straight into the feedback form — no SignalR.
        if args.contains("-uiTestShowFeedback") {
            let expireAt = ISO8601DateFormatter().string(from: Date().addingTimeInterval(600))
            env.gatewayCenter.modeChanged = .FEEDBACK
            env.gatewayCenter.showFeedback = FeedbackShowPayload(
                sessionId: "uitest-session",
                caseId: "uitest-case",
                staff: StaffInfo(id: "uitest-staff", name: "UI Test Staff"),
                expireAt: expireAt
            )
            print("🧪 UITestSupport: seeded SHOW_FEEDBACK event")
        }
    }
}
#endif
