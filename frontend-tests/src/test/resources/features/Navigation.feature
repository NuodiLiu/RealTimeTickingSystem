@Frontend @Regression @Navigation
Feature: Frontend routing and auth-guard redirects

  @Smoke
  Scenario: The home page sends an unauthenticated visitor to the login page
    # `/` hard-redirects to `/dashboard`, whose AuthGuard then bounces an
    # unauthenticated visitor to `/login`. The stable end-state is `/login`;
    # the `/dashboard` hop is too brief to assert against reliably.
    When Visitor opens the home page
    Then Visitor should be redirected to the "/login" path

  Scenario: An unauthenticated visitor visiting /dashboard is bounced to /login
    Given Visitor opens the dashboard page
    Then Visitor should be redirected to the "/login" path
