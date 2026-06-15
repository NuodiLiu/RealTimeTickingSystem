@Frontend @Regression @Navigation @NavigationExtras
Feature: Navigation edge cases — unknown routes and post-logout back-button

  Scenario: Visiting an unknown frontend path lands on the 404 page
    When Visitor opens the path "/this-path-does-not-exist"
    Then Visitor should see the Next.js 404 page

  Scenario: Pressing browser-back after logout does not restore the dashboard
    Given Staff is logged in as "STAFF"
    Then Staff should land on the dashboard
    When Staff opens the user dropdown
    And Staff clicks the Logout option
    Then Staff should be returned to the login page
    When Staff presses the browser back button
    Then Staff should not be on the dashboard
