@Frontend @Regression @Dashboard @Admin @ExcelExport
Feature: Admin Excel export modal

  Background:
    Given Administrator is logged in as "ADMIN"
    Then Administrator should land on the dashboard
    And Administrator should see the Export to Excel button

  @Smoke
  Scenario: Clicking Export to Excel opens the export modal
    When Administrator clicks the Export to Excel button
    Then Administrator should see the Export Cases to Excel modal
    And the export modal should hint that filters must be selected
    And the Export to Excel modal button should be disabled

  Scenario: The Cancel button dismisses the export modal
    When Administrator clicks the Export to Excel button
    Then Administrator should see the Export Cases to Excel modal
    When Administrator clicks Cancel on the export modal
    Then the export modal should no longer be visible

  # The X (close) icon button is intentionally not exercised here — the
  # currently-deployed test environment ships an older modal markup whose
  # aria-label differs. The Cancel scenario covers the same dismiss path.
