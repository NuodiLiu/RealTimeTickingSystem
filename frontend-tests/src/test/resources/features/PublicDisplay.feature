@Frontend @Regression @PublicDisplay
Feature: Public help desk queue display

  The public-display page is unauthenticated and shows the live waiting queue
  to anyone in front of the kiosk monitor.

  @Smoke
  Scenario: Visitor sees the Help Desk Queue banner with a count
    Given Visitor opens the public display page
    Then Visitor should see the Help Desk Queue banner
    And Visitor should see a non-negative queue count

  Scenario: Visitor sees either the empty queue message or queue cards
    Given Visitor opens the public display page
    Then Visitor should see either the empty queue message or at least one queue card
