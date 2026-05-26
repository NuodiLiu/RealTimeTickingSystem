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
    static func applyIfNeeded(env: AppEnvironment) {
        guard isUITesting else { return }

        // Always start each UI test from a clean slate.
        try? env.authProvider.clearDevice()
        env.modeStore.clear()

        // `-uiTestPaired <mode>` injects credentials => RootViewModel sees a
        // non-nil deviceApiKey and treats the device as already paired.
        if let idx = args.firstIndex(of: "-uiTestPaired"), idx + 1 < args.count {
            let mode = DeviceMode(rawValue: args[idx + 1]) ?? .REGISTRATION
            let creds = DeviceCredentials(
                deviceId: "uitest-device",
                apiKey: "uitest-device:uitest-secret",
                mode: mode
            )
            try? env.authProvider.storeDevice(credentials: creds)
            env.modeStore.save(mode)
            print("🧪 UITestSupport: seeded paired credentials, mode=\(mode.rawValue)")
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
