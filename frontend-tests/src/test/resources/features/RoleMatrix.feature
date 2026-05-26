@Frontend @Regression @Dashboard @RoleMatrix
Feature: Role-gated UI visibility matrix

  Consolidates per-role visibility expectations into a single Scenario
  Outline so a future role addition only requires editing the examples
  table.

  Scenario Outline: <Role> sees <Visibility> for "<Button>"
    Given Staff is logged in as "<Role>"
    Then Staff should land on the dashboard
    Then the dashboard button "<Button>" should be <Visibility>

    # Pair Device intentionally omitted: it lives inside ResponsiveLayout's
    # iPad Devices section, which sometimes renders behind an overlay that
    # masks element lookups in headed Chrome. The Devices.feature exercises
    # that button directly; this matrix focuses on the role-meaningful
    # control (Export to Excel) plus one sanity row.
    Examples:
      | Role  | Button          | Visibility |
      | STAFF | TAKE NEXT       | visible    |
      | STAFF | Export to Excel | hidden     |
      | ADMIN | TAKE NEXT       | visible    |
      | ADMIN | Export to Excel | visible    |
