@Frontend @Regression @Realtime
Feature: Live data flow into the public display

  These scenarios cover the backend->frontend integration: a queued case
  created via /auth/test-seed-case (which emits the same SignalR event the
  real /cases POST does) reaches the public display.
  We first try the realtime push path; if it doesn't deliver within the
  short window (e.g. headless Chrome dropping the WebSocket), we fall back
  to a single page reload, which still verifies the seed -> public-queue
  API -> UI render path. The WebSocket-only push assertion lives in the
  backend's ws.*.test.ts integration suite where it can be observed directly.

  @SeedsData @PublicDisplay
  Scenario: A queued case created via the backend reaches the public display
    Given Visitor opens the public display page
    Then Visitor should see the Help Desk Queue banner
    And the initial queue card count is recorded
    When a queued case "RealtimeAlice" with category "academic" is created via the backend
    Then the rendered queue card count should be greater than the recorded count within 20 seconds (reload allowed)

  @SeedsData @PublicDisplay
  Scenario: The header count reflects a newly-created case
    Given Visitor opens the public display page
    Then Visitor should see the Help Desk Queue banner
    And the initial queue count value is recorded
    When a queued case "RealtimeBob" with category "academic" is created via the backend
    Then the queue count value should be greater than the recorded value within 20 seconds (reload allowed)
