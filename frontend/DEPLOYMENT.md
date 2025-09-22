## Frontend Deployment Guide (Next.js)

This app is a Next.js 15 project (App Router) located in `frontend/`. The backend is an Azure Functions app that also wraps the Express API under `/api/app`. Below are the recommended deployment paths.

---

## Option A — Vercel (recommended)

Vercel is the native host for Next.js and supports SSR/Edge automatically.

1) Prepare backend URLS
- Azure Functions base URL (no trailing slash):
  - Example: `https://<function-app>.azurewebsites.net`
- Express API base (Functions http proxy route):
  - Example: `https://<function-app>.azurewebsites.net/api/app`

2) Create a Vercel project
- Import your Git repository into Vercel
- Monorepo: set “Root Directory” to `frontend`
- Framework preset: Next.js

3) Environment variables (Project → Settings → Environment Variables)
- NEXT_PUBLIC_API_URL = https://<function-app>.azurewebsites.net
- NEXT_PUBLIC_API_BASE_URL = https://<function-app>.azurewebsites.net/api/app
- NEXT_PUBLIC_APP_URL = https://<your-frontend-domain>  (Vercel preview: later replaced by custom domain)

Notes:
- Authentication is handled by the backend (`/auth/login` etc.), so Azure AD vars aren’t strictly required on the frontend unless you add MSAL client flows. Keep `.env.example` as reference.
- If you use a custom domain, update NEXT_PUBLIC_APP_URL accordingly and also set the same domain in backend CORS.

4) Build settings on Vercel
- Install command: `npm ci`
- Build command: `npm run build`
- Output: auto (Vercel detects Next.js)
- Node: Vercel uses a compatible Node 18+/20 runtime automatically

5) Configure backend CORS (Azure Function App → CORS)
- Add your frontend domain(s), e.g. `https://<your-frontend-domain>` and `https://<project>.vercel.app`
- If using cookies from backend, ensure backend sets proper SameSite/Domain (already handled dynamically; still prefer same site domain when possible)

6) Verify after deploy
- Visit `https://<your-frontend-domain>/login`
- Click “Continue with Microsoft” → should redirect to backend `/auth/login`
- Open DevTools → Network and confirm calls go to `NEXT_PUBLIC_API_BASE_URL`
- Open console and verify SignalR negotiate POST to `NEXT_PUBLIC_API_URL/api/negotiate` succeeds

Troubleshooting
- 401 loops → ensure backend refresh endpoint works and cookies are set; domain/SSL must be correct
- CORS errors → verify Function App CORS list and that `NEXT_PUBLIC_*` origins match exactly (protocol + host + port)
- SignalR fail to connect → check Function App negotiate endpoint and SignalR Service upstream callbacks configuration

---

## Option B — Azure Static Web Apps (SWA)

SWA can host Next.js including SSR using its built-in serverless runtime. Since your backend already runs as a separate Azure Function App, SWA will primarily serve the frontend and call your existing backend.

High-level steps:
1) Create a Static Web App in Azure Portal
2) Connect to your repo and set the app folder to `frontend`
3) Build presets: Framework = Next.js
4) Environment variables: same as Vercel
5) In SWA CORS, allow calls to your Function App if needed, and in the Function App CORS allow your SWA domain

Note: If you later decide to consolidate into a single SWA with “SWA API”, you’ll need to migrate/align the backend. Current setup recommends keeping the existing Function App backend.

---

## Option C — Azure App Service (Node server)

If you prefer a traditional Node host:
1) Build locally/CI: `npm ci && npm run build`
2) Deploy the `frontend/` app to an App Service with Node 18+
3) Startup command: `npm start` (Next.js production server)
4) Set environment variables in App Service → Configuration (same as above)
5) Configure CORS on the backend Function App to allow the App Service domain

This option is fine but offers fewer Next-native conveniences than Vercel.

---

## Environment variables reference

- NEXT_PUBLIC_API_URL
  - The Azure Functions base (used by SignalR negotiate POST)
  - Example: `https://<function-app>.azurewebsites.net`

- NEXT_PUBLIC_API_BASE_URL
  - Your Express API base routed through the Function App
  - Example: `https://<function-app>.azurewebsites.net/api/app`

- NEXT_PUBLIC_APP_URL
  - Public URL where this frontend is accessible
  - Example: `https://<your-frontend-domain>`

Optional Azure AD values (only if you implement client-side MSAL):
- NEXT_PUBLIC_AZURE_AD_CLIENT_ID
- NEXT_PUBLIC_AZURE_AD_TENANT_ID
- NEXT_PUBLIC_AZURE_AD_REDIRECT_URI
- NEXT_PUBLIC_AZURE_AD_AUTHORITY
- NEXT_PUBLIC_API_SCOPE

---

## Local run (for reference)

From `frontend/`:

1) Copy `.env.example` to `.env.local` and adjust values
2) `npm ci`
3) `npm run dev` → http://localhost:3001

Production preview locally:
1) `npm run build`
2) `npm start` → http://localhost:3000 (or set `-p` port)

---

## After deploying the frontend

Backend checks to complete:
- Azure Function App CORS includes your frontend domain(s)
- SignalR Service Upstream points to your Function App event endpoints with Function Key
- App Settings on Function App match your production secrets (DB, SignalR, JWT secret, etc.)

Smoke tests:
- /login loads without CORS errors
- Sign-in redirects to backend and returns to app
- Device dashboard updates in real-time (SignalR connected)
