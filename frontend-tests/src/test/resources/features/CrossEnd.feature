@Frontend @Regression @CrossEnd
Feature: Cross-end (browser + iPad simulator) integration

  These scenarios drive *both* a staff Chrome window (Selenium) and a paired
  iPad simulator (Appium / XCUITest) in the same Cucumber scenario. They are
  local-only — run via scripts/run-crossend.sh, never on CI.

  Prerequisites:
    1. Appium server on http://127.0.0.1:4723 (`appium --port 4723`)
    2. A booted iPad simulator (e.g. `xcrun simctl boot "iPad (A16)"`)
    3. KioskApp built for simulator at the path declared in serenity.conf
       (`kiosk.app.path`, default /tmp/kioskapp-derived/...)

  @SeedsData @KioskSmoke
  Scenario: A Feedback iPad simulator paired via the backend lands on the feedback cover
    Given a Feedback iPad simulator paired via the backend
    Then the iPad should show the feedback cover within 20 seconds

  @SeedsData @KioskRoundTrip
  Scenario: Staff sends feedback to a paired kiosk and the iPad renders the form
    Given a Feedback iPad simulator paired via the backend
    And the iPad should show the feedback cover within 20 seconds
    And a queued case "RoundTripAlice" with category "academic" exists
    When the staff backend takes the next queued case
    And the staff backend sends feedback to the paired kiosk
    Then the iPad should show the feedback form within 20 seconds

  @SeedsData @KioskThreeScreenSync
  Scenario: Three-screen sync — iPad registration appears on staff queue and public display
    Given StaffBrowser is logged in as "STAFF"
    Then StaffBrowser should land on the dashboard
    And Visitor opens the public display page
    Then Visitor should see the Help Desk Queue banner
    And a Registration iPad simulator paired via the backend
    When the iPad enters student name "E2E_ThreeSync" and zID "z8888888"
    And the iPad accepts the privacy policy
    And the iPad taps Submit Registration
    Then the iPad should show the registration success message within 15 seconds
    And StaffBrowser should see a queue case for "E2E_ThreeSync" within 25 seconds
    And Visitor should see a queue card for "E2E_ThreeSync" within 25 seconds

  @SeedsData @KioskClose
  Scenario: iPad taps Close on the feedback form and the form closes
    # Setup: staff dashboard pushes a feedback form to the iPad (the same
    # two-sided wiring L4/L9 exercise). The iPad-side assertion is the
    # focus here: the Close button must dismiss the form cleanly.
    # (The case status stays at RESOLVED_PENDING_FEEDBACK afterwards —
    # FEEDBACK_CANCELLED from the iPad races view-teardown today.)
    Given a Feedback iPad simulator paired via the backend
    And the iPad should show the feedback cover within 20 seconds
    And a queued case "CloseAlice" with category "academic" exists
    And Staff is logged in as "STAFF"
    Then Staff should land on the dashboard
    When Staff selects the paired test kiosk from the device list
    And Staff clicks TAKE NEXT
    And Staff clicks FEEDBACK on the active case for "CloseAlice"
    Then the iPad should show the feedback form within 20 seconds
    When the iPad taps Close on the feedback form
    Then the iPad should return to the feedback cover within 25 seconds

  @SeedsData @KioskStaffResolve
  Scenario: Staff resolves a PENDING case and the iPad's feedback form dismisses
    Given a Feedback iPad simulator paired via the backend
    And the iPad should show the feedback cover within 20 seconds
    And a queued case "ResolveAlice" with category "academic" exists
    And Staff is logged in as "STAFF"
    Then Staff should land on the dashboard
    When Staff selects the paired test kiosk from the device list
    And Staff clicks TAKE NEXT
    And Staff clicks FEEDBACK on the active case for "ResolveAlice"
    Then the iPad should show the feedback form within 20 seconds
    When Staff clicks RESOLVE on the active case for "ResolveAlice"
    Then the iPad should return to the feedback cover within 20 seconds
    And the backend should record case for "ResolveAlice" with status RESOLVED within 15 seconds

  @SeedsData @KioskOverride
  Scenario: Staff overrides a busy kiosk and the iPad swaps to the new case
    Given a Feedback iPad simulator paired via the backend
    And the iPad should show the feedback cover within 20 seconds
    And a queued case "OverrideAlice" with category "academic" exists
    And a queued case "OverrideBob" with category "academic" exists
    And Staff is logged in as "STAFF"
    Then Staff should land on the dashboard
    When Staff selects the paired test kiosk from the device list
    And Staff clicks TAKE NEXT
    And Staff clicks TAKE NEXT
    And Staff clicks FEEDBACK on the active case for "OverrideAlice"
    Then the iPad should show the feedback form within 20 seconds
    And the dashboard recognises the paired kiosk as busy within 15 seconds
    # The dashboard's `selectedDevice.currentLock` is only refreshed on a full
    # device-list refetch — the device:updated push omits currentLock — so a
    # page reload is required before the override-toast branch can trigger.
    When Staff reloads the dashboard
    And Staff selects the paired test kiosk from the device list
    And Staff clicks FEEDBACK on the active case for "OverrideBob"
    Then Staff should see the Override Device confirmation
    When Staff confirms the override
    Then the iPad should show the feedback form within 30 seconds

  @KioskUnpair
  Scenario: Staff unpairs a Feedback iPad and the iPad returns to the pairing screen
    Given a Feedback iPad simulator paired via the backend
    And the iPad should show the feedback cover within 20 seconds
    And Staff is logged in as "STAFF"
    Then Staff should land on the dashboard
    And the staff dashboard should list the freshly paired test kiosk within 20 seconds
    When Staff opens the actions menu for the paired test kiosk
    And Staff clicks Unpair Device on the menu
    Then the iPad should return to the pairing screen within 25 seconds

  @KioskModeChange
  Scenario: Staff switches a Feedback iPad to Registration mode and the iPad UI follows
    Given a Feedback iPad simulator paired via the backend
    And the iPad should show the feedback cover within 20 seconds
    And Staff is logged in as "STAFF"
    Then Staff should land on the dashboard
    And the staff dashboard should list the freshly paired test kiosk within 20 seconds
    When Staff opens the actions menu for the paired test kiosk
    And Staff clicks Switch to Registration on the menu
    Then the iPad should show the registration screen within 25 seconds

  @SeedsData @KioskRegistration
  Scenario: A walk-up student registers on the iPad and the staff queue updates
    Given a Registration iPad simulator paired via the backend
    And Staff is logged in as "STAFF"
    Then Staff should land on the dashboard
    When the iPad enters student name "E2E_RegStudent" and zID "z9999999"
    And the iPad accepts the privacy policy
    And the iPad taps Submit Registration
    Then the iPad should show the registration success message within 15 seconds
    And the staff queue should list a case for "E2E_RegStudent" within 20 seconds

  @KioskQrPairing
  Scenario: True QR pairing flow — iPad scans, staff dashboard sees new device
    Given an unpaired Registration iPad simulator is on the pairing screen
    And Staff is logged in as "STAFF"
    Then Staff should land on the dashboard
    When the iPad selects Registration mode
    And the iPad taps Scan QR Code to Pair
    And the iPad taps Simulate QR Scan
    Then the iPad should show the registration screen within 30 seconds
    And the staff dashboard should list the freshly paired test kiosk within 30 seconds

  @SeedsData @KioskFullRoundTrip
  Scenario: Full feedback round-trip driven by both UIs (staff clicks + iPad clicks)
    Given a Feedback iPad simulator paired via the backend
    And the iPad should show the feedback cover within 20 seconds
    And a queued case "FullTripVisitor" with category "academic" exists
    And Staff is logged in as "STAFF"
    Then Staff should land on the dashboard
    When Staff selects the paired test kiosk from the device list
    And Staff clicks TAKE NEXT
    And Staff clicks FEEDBACK on the active case for "FullTripVisitor"
    Then the iPad should show the feedback form within 20 seconds
    When the iPad rates 5 stars
    And the iPad taps Submit Feedback
    # The thank-you modal renders for <500ms before the view auto-dismisses;
    # the stable post-submit state is the feedback cover, so assert against
    # that instead of racing the spring animation.
    Then the iPad should return to the feedback cover within 30 seconds
