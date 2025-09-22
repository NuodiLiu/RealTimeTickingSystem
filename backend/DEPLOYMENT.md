# Backend Azure Functions Deployment Guide

This guide describes how to deploy the Node.js/TypeScript backend to Azure Functions (Linux, Functions v4, Node 18+).

## Prerequisites

- Azure CLI and login
- Azure Functions Core Tools v4
- VS Code Azure Functions extension (optional)
- Resource names (replace as needed):
  - Resource Group: `rg-realtime-func`
  - Region: `australiaeast` (or your closest)
  - Storage Account: globally-unique, e.g. `rttickstg$RANDOM`
  - Function App name: globally-unique, e.g. `rttick-func-001`

## Provision Azure resources (once)

```bash
RG=rg-realtime-func
LOC=australiaeast
APP=rttick-func-001
STG=rttickstg$RANDOM

az group create -n $RG -l $LOC
az storage account create -g $RG -n $STG -l $LOC --sku Standard_LRS
az functionapp create -g $RG -n $APP -s $STG -c $LOC \
  --runtime node --functions-version 4 --os-type Linux
```

## Configure app settings (env vars)

Map sensitive values from `.env` or `local.settings.json` into Azure App Settings. Do NOT commit secrets.

```bash
az functionapp config appsettings set -g $RG -n $APP --settings \
  NODE_ENV=production \
  EXPRESS_BASE_PATH=/api/app \
  FRONTEND_URL=https://your-frontend.example.com \
  DATABASE_URL="<postgres-connection-string>" \
  JWT_SECRET="<jwt-secret>" \
  SESSION_KEYS="<key1>,<key2>" \
  AZURE_SIGNALR_CONNECTION_STRING="<signalr-conn>" \
  AZURE_SIGNALR_HUB_NAME=realtimeticket \
  AZURE_AD_TENANT_ID="<tenant>" \
  AZURE_AD_CLIENT_ID="<client>" \
  AZURE_AD_API_CLIENT_ID="<api-client>" \
  AZURE_AD_CLIENT_SECRET="<secret>"
```

Notes:
- local.settings.json is for local only; it is ignored by deployment.
- For SignalR, ensure the connection string and hub name match your service.
- Use Key Vault references for production secrets if possible.

## Build and publish

```bash
# From backend folder
export AZURE_FUNCTIONAPP=$APP
npm ci
npm run build:functions
func azure functionapp publish $AZURE_FUNCTIONAPP
```

## Routes and triggers

- Express API is exposed under `/api/app/*` via `src/functions.ts` (Functions v4 model)
- SignalR endpoints:
  - Negotiate: `POST/GET /api/negotiate` (anonymous; validates your App JWT)
  - Events: `POST /api/signalr/{connected|disconnected|message}` (function-level key auth)
- Direct SignalR hubs (e.g. `/api/signalr`) are intentionally blocked by `functions.ts` and should not be hit directly.

## Logs and diagnostics

```bash
az functionapp log tail -g $RG -n $APP
```

## Common pitfalls

- Avoid legacy `function.json` when using the v4 programming model. We keep legacy files disabled.
- Ensure Prisma Client is generated on install (`postinstall` hook) and DATABASE_URL is set at runtime.
- CORS: Configure in Azure Portal or via CLI for your frontend origin.

```bash
az functionapp cors add -g $RG -n $APP --allowed-origins https://your-frontend.example.com
```

## Rollback

Re-publish a known-good commit or use deployment slots (Premium plan) for safer swaps.

---

If you want GitHub Actions CI/CD, we can add a workflow that builds and publishes on push to main.
