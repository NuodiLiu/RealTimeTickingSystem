@Frontend @Regression @Dashboard
Feature: Staff dashboard layout and controls

  Background:
    Given Staff is logged in as "STAFF"
    Then Staff should land on the dashboard

  @Smoke
  Scenario: The dashboard renders the Queue, Active Cases and Devices sections
    Then Staff should see the three dashboard sections
    And Staff should see the Take Next button
    And Staff should see a queue counter
    And Staff should see the device sublists for Feedback and Registration
    And Staff should see the Pair Device button

  Scenario: Staff can open the user menu and see Logout
    When Staff opens the user dropdown
    Then Staff should see a Logout option

  Scenario: Staff can log out from the dashboard
    When Staff opens the user dropdown
    And Staff clicks the Logout option
    Then Staff should be returned to the login page
