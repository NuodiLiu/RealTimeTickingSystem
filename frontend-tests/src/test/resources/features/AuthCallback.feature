@Frontend @Regression @Login @AuthCallback
Feature: /auth/callback and login error-banner edge cases

  @Smoke
  Scenario: The login page without an error code does not show the red error banner
    Given Staff is on the ticketing login page
    Then the login error banner should not be visible

  Scenario: The auth callback page with no token shows the failure UI
    When Visitor opens the auth callback page without parameters
    Then Visitor should see the Authentication Failed UI
    And Visitor should see the no-token message

  Scenario: The auth callback page with an explicit error parameter shows the failure UI
    When Visitor opens the auth callback page with error "oauth_error"
    Then Visitor should see the Authentication Failed UI
    And Visitor should see the generic authentication-failed message
