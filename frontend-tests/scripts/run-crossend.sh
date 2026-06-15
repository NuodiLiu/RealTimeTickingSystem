#!/usr/bin/env bash
# Local-only runner for the cross-end (browser + iPad simulator) scenarios.
# Not invoked from CI. Marks delivery as "manual cross-end E2E".
#
# Prereqs (one-time on this machine):
#   brew install --cask android-platform-tools  # nope, just Xcode-side
#   npm install -g appium
#   appium driver install xcuitest
#   xcodebuild requires Xcode 15+ and an iPad simulator with iOS 17+
#
# What this does:
#   1. Builds KioskApp.app for the iPad simulator (~30s first time, ~2s incremental)
#   2. Boots the iPad simulator if it isn't already
#   3. Starts Appium server on :4723 (or reuses an already-running one)
#   4. Runs the @CrossEnd Cucumber scenarios via mvn verify against the
#      deployed test backend (same env as the rest of the frontend-tests suite)
#   5. Leaves Appium and the simulator running for repeat runs; pass `--shutdown`
#      to tear them down

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")"/../.. && pwd)"
KIOSK_PROJECT="$PROJECT_ROOT/KioskApp/KioskApp.xcodeproj"
DERIVED_DATA="/tmp/kioskapp-derived"
APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphonesimulator/KioskApp.app"
SIM_NAME="${KIOSK_SIM_NAME:-iPad (A16)}"
APPIUM_PORT="${APPIUM_PORT:-4723}"

if [[ "${1:-}" == "--shutdown" ]]; then
  echo "==> Shutting down Appium + simulator"
  pkill -f "appium" 2>/dev/null || true
  xcrun simctl shutdown all 2>/dev/null || true
  exit 0
fi

JAVA_HOME="${JAVA_HOME:-/opt/homebrew/Cellar/openjdk/25.0.2/libexec/openjdk.jdk/Contents/Home}"
export JAVA_HOME

echo "==> Building KioskApp for iOS Simulator"
xcodebuild -project "$KIOSK_PROJECT" \
  -scheme KioskApp \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath "$DERIVED_DATA" \
  -arch arm64 \
  build >/dev/null

[[ -d "$APP_PATH" ]] || { echo "Build did not produce $APP_PATH"; exit 1; }

echo "==> Booting simulator: $SIM_NAME"
SIM_UDID="$(xcrun simctl list devices available -j | jq -r ".devices | to_entries[] | .value[] | select(.name==\"$SIM_NAME\") | .udid" | head -1)"
[[ -n "$SIM_UDID" ]] || { echo "Simulator not found: $SIM_NAME"; exit 1; }
xcrun simctl boot "$SIM_UDID" 2>/dev/null || true
open -a Simulator || true

# Pre-grant camera so the QR-pairing scenario can render the scanner view
# without a permission alert that's flaky to dismiss across scenarios.
xcrun simctl privacy "$SIM_UDID" grant camera Inddev.KioskApp 2>/dev/null || true

echo "==> Ensuring Appium server is up on :$APPIUM_PORT"
if ! curl -sS "http://127.0.0.1:$APPIUM_PORT/status" >/dev/null 2>&1; then
  appium --port "$APPIUM_PORT" --base-path / --log-level info > /tmp/appium.log 2>&1 &
  until curl -sS "http://127.0.0.1:$APPIUM_PORT/status" >/dev/null 2>&1; do sleep 1; done
fi

cd "$PROJECT_ROOT/frontend-tests"
echo "==> Running @CrossEnd scenarios against the deployed test env"
mvn -q verify -Denvironment=test "-Dcucumber.filter.tags=@CrossEnd"
