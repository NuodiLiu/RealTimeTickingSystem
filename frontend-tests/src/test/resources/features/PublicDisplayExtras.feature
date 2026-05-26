@Frontend @Regression @PublicDisplay @PublicDisplayExtras
Feature: Public display — count/cards consistency and real data rendering

  Background:
    Given Visitor opens the public display page

  @Smoke
  Scenario: The header count matches the number of cards rendered
    Then the header queue count should equal the number of queue cards

  @SeedsData
  Scenario: A seeded queued case appears as a card with its student name
    Given a queued case "Alice" with category "academic"
    When Visitor reloads the public display page
    Then a queue card for "Alice" should be visible
