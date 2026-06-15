//
//  PairingUITests.swift
//  KioskAppUITests
//
//  UI tests for the device-pairing flow and the screens behind it.
//
//  Two strategies are used:
//   • Bypass — `-uiTestPaired <mode>` injects fake credentials so the app
//              launches straight into the business screen. Fast, needs no
//              backend, used for everything *after* pairing.
//   • Real   — drives the actual pairing UI; on the Simulator the QR scan is
//              replaced by the app's built-in "Simulate QR Scan (Dev Token)"
//              button. Requires a local dev backend (see testRealPairing...).
//

import XCTest

final class PairingUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    // MARK: - Bypass strategy (no backend needed)

    /// An unpaired launch must land on the pairing screen.
    func testUnpairedLaunchShowsPairingScreen() {
        let app = XCUIApplication()
        app.launchUITest()
        XCTAssertTrue(app.buttons["pairing.scanButton"].waitForExistence(timeout: 10),
                      "Expected the pairing screen's scan button.")
    }

    /// Injected REGISTRATION credentials must skip pairing and open Registration.
    func testPairedLaunchOpensRegistration() {
        let app = XCUIApplication()
        app.launchUITest(paired: "REGISTRATION")
        XCTAssertTrue(app.staticTexts["registration.title"].waitForExistence(timeout: 10),
                      "Expected the Registration screen.")
        XCTAssertFalse(app.buttons["pairing.scanButton"].exists,
                       "Pairing screen must not be shown when already paired.")
    }

    /// Injected FEEDBACK credentials must skip pairing and open the Feedback cover.
    func testPairedLaunchOpensFeedbackCover() {
        let app = XCUIApplication()
        app.launchUITest(paired: "FEEDBACK")
        XCTAssertTrue(app.staticTexts["feedback.coverTitle"].waitForExistence(timeout: 10),
                      "Expected the Feedback cover screen.")
    }

    /// A seeded SHOW_FEEDBACK event must render the feedback form (not the cover).
    /// State is injected directly — this test does not touch SignalR; the
    /// envelope-to-state wiring is covered by GatewayCenterTests/RootViewModelTests.
    func testShowFeedbackEventOpensFeedbackForm() {
        let app = XCUIApplication()
        app.launchUITest(paired: "FEEDBACK", showFeedback: true)
        XCTAssertTrue(app.staticTexts["feedback.formTitle"].waitForExistence(timeout: 10),
                      "Expected the feedback rating form.")
    }

    // MARK: - Pairing screen interactions (no backend needed)

    /// The two mode cards on the pairing screen are present and tappable.
    func testPairingScreenModeSelection() {
        let app = XCUIApplication()
        app.launchUITest()

        let registration = app.buttons["pairing.mode.REGISTRATION"]
        let feedback = app.buttons["pairing.mode.FEEDBACK"]
        XCTAssertTrue(registration.waitForExistence(timeout: 10))
        XCTAssertTrue(feedback.exists)

        feedback.tap()
        registration.tap()
        // Still on the pairing screen — selecting a mode does not pair.
        XCTAssertTrue(app.buttons["pairing.scanButton"].exists)
    }

    // MARK: - Real pairing (requires a local dev backend)

    /// Drives the genuine pairing flow end to end.
    ///
    /// Prerequisites:
    ///   1. Backend running on the host at http://localhost:3000 with
    ///      NODE_ENV=development — so the `test-token-123` dev token is accepted.
    ///   2. Run on an iOS Simulator — the dev-token shortcut is simulator-only.
    func testRealPairingWithDevToken() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Real pairing uses the Simulator-only dev-token shortcut.")
        #endif

        let app = XCUIApplication()
        app.launchUITest(apiBaseURL: "http://localhost:3000")

        // 1. Pick a device mode.
        let modeCard = app.buttons["pairing.mode.REGISTRATION"]
        XCTAssertTrue(modeCard.waitForExistence(timeout: 10))
        modeCard.tap()

        // 2. Open the scanner (this triggers the camera-permission prompt).
        app.buttons["pairing.scanButton"].tap()
        XCUIApplication.allowCameraPermissionIfNeeded()

        // 3. Stand in for scanning a QR code with the dev-token shortcut.
        let simulateButton = app.buttons["pairing.simulateScanButton"]
        XCTAssertTrue(simulateButton.waitForExistence(timeout: 10),
                      "Simulator scan shortcut not shown — was camera permission granted?")
        simulateButton.tap()

        // 4. POST /pair/complete succeeds => the app lands on Registration.
        XCTAssertTrue(app.staticTexts["registration.title"].waitForExistence(timeout: 20),
                      "Pairing did not complete. Is the dev backend up on :3000 with NODE_ENV=development?")
    }
}

// MARK: - Helpers

extension XCUIApplication {

    /// Launch the app in UI-test mode.
    /// - Parameters:
    ///   - paired: when set ("REGISTRATION"/"FEEDBACK"), seeds credentials so
    ///     pairing is skipped; when nil the app launches unpaired.
    ///   - showFeedback: when true, seeds a SHOW_FEEDBACK event so the app
    ///     boots into the feedback form (pair as "FEEDBACK" alongside this).
    ///   - apiBaseURL: overrides the backend base URL (DEBUG builds only).
    func launchUITest(paired mode: String? = nil,
                      showFeedback: Bool = false,
                      apiBaseURL: String? = nil) {
        launchArguments += ["-uiTesting"]
        if let mode { launchArguments += ["-uiTestPaired", mode] }
        if showFeedback { launchArguments += ["-uiTestShowFeedback"] }
        if let apiBaseURL { launchEnvironment["API_BASE_URL"] = apiBaseURL }
        launch()
    }

    /// Dismiss the system camera-permission alert by granting access, if shown.
    @discardableResult
    static func allowCameraPermissionIfNeeded(timeout: TimeInterval = 5) -> Bool {
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let ok = springboard.buttons["OK"]
        if ok.waitForExistence(timeout: timeout) {
            ok.tap()
            return true
        }
        for label in ["Allow", "Allow While Using App"] {
            let button = springboard.buttons[label]
            if button.exists {
                button.tap()
                return true
            }
        }
        return false
    }
}
