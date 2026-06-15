# Local dev quickstart

End-to-end loop: Next.js frontend (`:3001`) → C# backend (`:5080`) → local
Postgres 16. SignalR is faked — handlers dispatch into
`FakeNotificationGateway` and the messages are exposed at
`GET /dev/notifications`. This is enough to validate every backend code path
that touches the realtime fan-out without standing up Azure SignalR.

## 0. Prerequisites

- .NET 10 SDK (`dotnet --version` ≥ 10)
- Docker (for the Postgres container)
- Node 20+ and pnpm/npm (for the frontend)

## 1. Start Postgres

```bash
docker compose -f docker-compose.dev.yml up -d
```

Wait for `pg_isready` to go green (a couple of seconds). The container exposes
`localhost:5433` and persists data in the named volume `tickets-pg-data` so
restarts keep your seeded state.

To wipe state:

```bash
docker compose -f docker-compose.dev.yml down -v
```

## 2. Apply EF migrations

```bash
cd backend-csharp
dotnet ef database update \
  --project src/Tickets.Infrastructure \
  --startup-project src/Tickets.WebApi
```

If `dotnet-ef` is not installed yet:
`dotnet tool install --global dotnet-ef --version 10.0.*`.

## 3. Run the backend

```bash
cd backend-csharp
dotnet run --project src/Tickets.WebApi
```

Listens on `http://localhost:5080`. CORS is open to `http://localhost:3000`
and `http://localhost:3001`. `ASPNETCORE_ENVIRONMENT=Development` is set in
`Properties/launchSettings.json`, which is what unlocks the dev-only
endpoints below.

Sanity-check: `curl http://localhost:5080/health` → `{"status":"ok"}`.

## 4. Seed baseline data

```bash
curl -X POST http://localhost:5080/dev/seed
```

Creates `admin@dev.local` (role Admin) plus three queued cases. Safe to
re-run — staff lookup is idempotent, cases are appended each call.

## 5. Sign in (dev-only)

The Azure AD redirect flow lands in Phase 5. Until then, mint a session with:

```bash
curl -X POST http://localhost:5080/auth/dev-login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"admin@dev.local","name":"Dev Admin","asAdmin":true}'
```

Response body contains `accessToken` (App-JWT, 2 h TTL) and `user`. The
HttpOnly refresh cookie `__Host-app_rf` is stored in `cookies.txt`.

Send `Authorization: Bearer <accessToken>` on subsequent requests; hit
`POST /auth/refresh` with the cookie when the JWT expires.

## 6. Run the frontend

```bash
cd frontend
echo 'NEXT_PUBLIC_API_BASE_URL=http://localhost:5080' > .env.local
npm install
npm run dev
```

Open `http://localhost:3001`. The dev-login page (or whatever the staff-side
entry route is) should produce an authenticated session backed by the same
cookie issued above.

## 7. Observe SignalR fan-out

The backend never speaks to the real Azure SignalR. Every notification call
is enqueued in an in-memory log.

```bash
# Snapshot every event handlers have dispatched so far.
curl http://localhost:5080/dev/notifications

# Clear the log between scenarios.
curl -X DELETE http://localhost:5080/dev/notifications
```

Typical loop:

1. `DELETE /dev/notifications`
2. Exercise the frontend (take a case, resolve a case, …)
3. `GET /dev/notifications` and assert the expected events are there
   (`case.queued`, `case.taken`, `case.resolved`, …)

## What this setup does NOT cover

- Azure AD redirect flow (`/auth/login` → `/auth/redirect`) — Phase 5.
- Real Azure SignalR delivery to the iPad kiosk — Phase 5.
- Webhook signature verification end-to-end — the middleware is wired but
  there is no upstream service calling it locally.

Everything else (state machine transitions, pairing, feedback, Excel export,
device heartbeat) is fully exercisable against the local Postgres.
