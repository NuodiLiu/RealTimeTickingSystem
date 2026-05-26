@Frontend @Regression @Dashboard @Devices
Feature: Device management from the staff dashboard

  Background:
    Given Staff is logged in as "STAFF"
    Then Staff should land on the dashboard

  @Smoke
  Scenario: Clicking Pair Device opens the QR-pairing modal
    When Staff clicks the Pair Device button
    Then Staff should see the pairing QR modal
    And Staff should see a pairing QR image within 10 seconds

  Scenario: Closing the QR modal removes it from the page
    When Staff clicks the Pair Device button
    Then Staff should see the pairing QR modal
    When Staff clicks the Close button on the pairing modal
    Then the pairing QR modal should no longer be visible

  # The deeper device-state scenarios (selection persistence in localStorage,
  # online/offline indicators, BUSY visual state, unpair / change-mode flows,
  # CompactDeviceSelector under narrow viewports) require a paired iPad
  # fixture which is not in scope for this suite. Those are covered in the
  # KioskAppUITests integration tests on the iOS side.
