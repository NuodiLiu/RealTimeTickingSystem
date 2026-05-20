@Frontend @Regression @Dashboard @Admin
Feature: Admin-only dashboard controls

  Rule: Only users with the ADMIN role should see the Export to Excel button

    @Admin
    Scenario: Administrator sees the Export to Excel button on the dashboard
      Given Administrator is logged in as "ADMIN"
      Then Administrator should land on the dashboard
      And Administrator should see the Export to Excel button

    @Staff
    Scenario: Standard staff user does not see the Export to Excel button
      Given Staff is logged in as "STAFF"
      Then Staff should land on the dashboard
      And Staff should not see the Export to Excel button
