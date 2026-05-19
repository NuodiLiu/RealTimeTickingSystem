@Frontend @Regression @Navigation
Feature: Frontend routing and auth-guard redirects

  @Smoke
  Scenario: The home page redirects unauthenticated visitors towards the dashboard route
    When Visitor opens the home page
    Then Visitor should be redirected to the "/dashboard" path

  Scenario: An unauthenticated visitor visiting /dashboard is bounced to /login
    Given Visitor opens the dashboard page
    Then Visitor should be redirected to the "/login" path
