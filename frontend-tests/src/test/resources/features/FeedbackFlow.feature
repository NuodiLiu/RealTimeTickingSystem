@Frontend @Regression @Dashboard @FeedbackFlow
Feature: Feedback button visibility and disabled state

  Background:
    Given Staff is logged in as "STAFF"
    Then Staff should land on the dashboard

  # The full override / offline / busy paths require a paired Feedback iPad in
  # a specific state (online + BUSY, offline, etc.). Those scenarios are out
  # of scope for the frontend regression suite and live in the iOS UI tests
  # (KioskAppUITests) and backend integration tests.
  #
  # What we *can* cover from the staff dashboard: that after taking a case,
  # the FEEDBACK button is rendered disabled when no Feedback device is
  # selected, and its tooltip explains why.

  @SeedsData
  Scenario: After taking a case the FEEDBACK button is disabled when no device is selected
    Given a queued case "Alice" with category "academic"
    And Staff reloads the dashboard
    When Staff clicks TAKE NEXT
    Then the FEEDBACK button for "Alice" should be disabled

  @SeedsData
  Scenario: Hovering the disabled FEEDBACK button surfaces the device-required reason
    Given a queued case "Alice" with category "academic"
    And Staff reloads the dashboard
    When Staff clicks TAKE NEXT
    And Staff hovers the FEEDBACK button for "Alice"
    Then the tooltip should explain a feedback device is required
