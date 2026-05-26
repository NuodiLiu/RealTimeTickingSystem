@Frontend @Regression @Dashboard @DashboardActions
Feature: Dashboard queue actions — take, resolve, escalate

  Background:
    Given Staff is logged in as "STAFF"
    Then Staff should land on the dashboard

  @Smoke
  Scenario: An empty queue shows the empty state message
    Given the test-case queue has been cleared
    Then Staff should see the empty-queue message

  Scenario: With no active cases Staff sees the active-cases empty state
    Given the test-case queue has been cleared
    Then Staff should see the empty active-cases message

  @SeedsData
  Scenario: TAKE NEXT pulls the oldest queued case into My Active Cases
    Given a queued case "Alice" with category "academic"
    And Staff reloads the dashboard
    When Staff clicks TAKE NEXT
    Then "Alice" should appear in My Active Cases
    And "Alice" should no longer be in the Queue

  @SeedsData
  Scenario: TAKE on a specific queue card moves that case into My Active Cases
    Given a queued case "Alice" with category "academic"
    And a queued case "Bob" with category "financial"
    And Staff reloads the dashboard
    When Staff clicks TAKE on the queue card for "Bob"
    Then "Bob" should appear in My Active Cases
    And "Alice" should still be in the Queue

  @SeedsData
  Scenario: RESOLVE removes the case from My Active Cases
    Given a queued case "Alice" with category "academic"
    And Staff reloads the dashboard
    When Staff clicks TAKE NEXT
    And Staff clicks RESOLVE on the active case for "Alice"
    Then "Alice" should no longer be in My Active Cases

  @SeedsData
  Scenario: Picking an escalation department shows the escalated badge
    Given a queued case "Alice" with category "academic"
    And Staff reloads the dashboard
    When Staff clicks TAKE NEXT
    And Staff opens the escalation dropdown for "Alice"
    And Staff selects "IT Support" as the escalation department for "Alice"
    Then the active case for "Alice" should show the badge "Escalated to IT Support"
