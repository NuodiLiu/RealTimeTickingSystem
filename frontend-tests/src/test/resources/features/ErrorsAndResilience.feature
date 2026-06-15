@Frontend @Regression @ErrorsAndResilience
Feature: Error and resilience surfaces

  Most of the application's error/resilience UI (the "Unable to connect to
  server" toast on 5xx, the React error.tsx error boundary, the LoadingSkeleton
  during slow first paint, the unhandled-promise rejection toast) is only
  reachable by injecting failures — broken backend responses, throttled
  networks, or thrown component errors. The Serenity + Selenium toolchain
  cannot inject those failures without a network-mock layer (e.g. a proxy or
  CDP fetch interception), so those scenarios are deliberately not asserted
  in this file. They are documented here as **out-of-scope** for the regression
  suite, with backend integration tests and the iOS UI suite covering the
  underlying error paths from those sides.
  See backend/tests/integration/*.test.ts and KioskAppUITests.

  # No live scenarios in this feature on purpose. The error/resilience surfaces
  # this suite *would* like to cover (offline toast, error boundary, slow-paint
  # skeleton, unhandled rejection toast) need a network/fault interception
  # layer that the current Selenium setup lacks. When that layer is added,
  # bring scenarios here.
