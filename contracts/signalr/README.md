# SignalR message contract

Canonical, on-the-wire JSON for every SignalR message exchanged between the
backend and the iPad kiosk app. These files are the **single source of truth**
for the message shapes — they exist so the backend, the iPad app, and the web
dashboard cannot drift apart silently.

## Why this exists

The web dashboard and the iPad never talk to each other directly — they both
talk to the backend. So "web ↔ iPad coordination" really means *the backend's
SignalR message contract*. That contract is currently declared twice:

- Backend — `backend/src/signalr/types.ts` (`ServerToDevice` / `DeviceToServer`)
- iPad    — `KioskApp/KioskApp/Core/Services/SignalRService.swift` (`ServerEnvelope`, payload structs)

Two hand-written copies drift. These fixtures pin the contract and are
validated from **both** sides:

| Side    | Test                                                   | Checks |
|---------|--------------------------------------------------------|--------|
| Backend | `backend/tests/contract/signalr-contract.test.ts`      | `SignalRClient` *produces* envelopes equal to these fixtures |
| iPad    | `KioskApp/KioskAppTests/GatewayCenterTests.swift`      | `GatewayCenter` *consumes* these fixtures into the right events |

If either side changes a field, its own contract test fails against the
unchanged fixture.

## Layout

```
contracts/signalr/
  server-to-device/   # backend → iPad (consumed by GatewayCenter)
    show-feedback.json
    dismiss.json
    mode-changed.json
    unpaired.json
    lock-assigned.json
    ping.json
```

Each file is the exact `{ "type", "payload" }` envelope as it travels over the
wire. Envelopes without a payload (`DISMISS`, `UNPAIRED`) omit the `payload` key.

## Adding or changing a message

1. Edit / add the fixture JSON here.
2. Update `backend/src/signalr/types.ts` and the iPad payload structs to match.
3. Run both contract test suites — they must pass against the new fixture.

Keep the fixtures realistic and internally consistent (e.g. `show-feedback`
and `lock-assigned` reference the same `caseId`).

## Not yet covered

`device-to-server` messages (`DELIVERED`, `PONG`, `STATUS`, `LEASE`,
`FEEDBACK_CANCELLED`) are part of the contract but not yet pinned here — the
iPad is their producer and asserting its encoded output needs a separate seam.
Tracked as a follow-up.
