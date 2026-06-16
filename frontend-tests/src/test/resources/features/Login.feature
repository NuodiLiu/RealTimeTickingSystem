@Frontend @Regression @Login
Feature: Sign in to the Real-Time Ticketing System

  Background:
    Given Staff is on the ticketing login page

  @Smoke
  Scenario: Login page displays the expected elements
    Then Staff should see the login page elements
    And Staff should see the Microsoft sign-in button

  Scenario Outline: Login page shows a friendly error when redirected with an error code
    When Staff navigates to the login page with error "<errorCode>"
    Then Staff should see the "<expectedMessage>" error message

    Examples:
      | errorCode        | expectedMessage                                       |
      | oauth_error      | Microsoft authentication failed. Please contact your administrator.    |
      | missing_code     | Authorization failed. Please try again.               |
      | auth_failed      | Authentication process failed. Please try again.      |
      | token_expired    | Your session has expired. Please log in again.        |
      | session_expired  | Your session has expired. Please log in again.        |
      | auth_required    | Authentication is required to continue.               |
      | refresh_failed   | Session refresh failed. Please log in again.          |
      | unknown_error    | An authentication error occurred. Please try again.   |

  @SSO
  Scenario: Staff signs in with Microsoft SSO and lands on the dashboard
    Given Staff signs in with Microsoft using the configured credentials
    Then Staff should land on the dashboard
    And Staff should see the header with their name
