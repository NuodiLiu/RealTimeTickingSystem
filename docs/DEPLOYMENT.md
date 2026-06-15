# Deployment

> ⚠️ **Auto-deploy is currently disabled.** The deploy workflow is **manual-only**
> (`workflow_dispatch`) because the C# backend isn't production-ready yet (Phase 5:
> real Azure SignalR + durable token stores pending; EF schema differs from the
> live Prisma DB). When the backend is ready and prod DB/config is set up, enable
> deploy-on-merge by uncommenting the `push:` trigger in the workflow.

Deploys to **Azure Container Apps** via
[`.github/workflows/deploy-azure.yml`](../.github/workflows/deploy-azure.yml):

| App | Source | Container App | Port |
|-----|--------|---------------|------|
| Backend (C#) | [`backend-csharp/`](../backend-csharp) (`Tickets.WebApi`, .NET 10) | `ca-tickets-backend` | 8080 |
| Frontend (Next.js) | [`frontend/`](../frontend) (standalone) | `ca-tickets-frontend` | 3000 |

Each image is built **remotely in ACR** (`azure/container-apps-deploy-action`),
then the matching Container App is updated. Only the app whose files changed is
deployed; use **Actions → Deploy to Azure Container Apps → Run workflow** to
force-deploy `backend`, `frontend`, or `both`.

> The workflow updates **images only**. Runtime config (DB connection string,
> JWT/SignalR secrets, etc.) must already be set on the Container Apps.

---

## One-time setup

Authentication is **OIDC** (no stored password). Run these once, substituting
your subscription / resource names.

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
RG=<your-resource-group>
REPO=NuodiLiu/RealTimeTickingSystem   # owner/repo

# 1. App registration the workflow authenticates as
APP_ID=$(az ad app create --display-name "gh-deploy-realtimeticketing" --query appId -o tsv)
az ad sp create --id "$APP_ID"

# 2. Federated credential: trust GitHub Actions on main (and the production env)
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "gh-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:'"$REPO"':ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "gh-env-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:'"$REPO"':environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'

# 3. Give it permission to build in ACR and update the Container Apps.
#    Scope to the resource group (simplest); tighten later if desired.
az role assignment create --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG"
az role assignment create --assignee "$APP_ID" --role AcrPush \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG"
```

> The workflow's `deploy-backend` / `deploy-frontend` jobs use the GitHub
> **`production`** environment, so the `gh-env-production` federated credential
> above is what's actually matched. If you remove `environment: production`
> from the jobs, the `gh-main` (branch) credential is used instead.

### GitHub secrets & variables

Settings → Secrets and variables → Actions:

**Secrets**
| Name | Value |
|------|-------|
| `AZURE_CLIENT_ID` | `echo $APP_ID` |
| `AZURE_TENANT_ID` | `echo $TENANT_ID` |
| `AZURE_SUBSCRIPTION_ID` | `echo $SUBSCRIPTION_ID` |

**Variables** (required)
| Name | Example |
|------|---------|
| `AZURE_RESOURCE_GROUP` | `rg-tickets` |
| `AZURE_CONTAINER_REGISTRY` | `caticketsacr` (name only) |
| `ACA_ENVIRONMENT` | `cae-tickets` (Container Apps environment) |

**Variables** (optional — defaults shown)
| Name | Default |
|------|---------|
| `AZURE_REGION` | `australiaeast` |
| `BACKEND_APP_NAME` | `ca-tickets-backend` |
| `FRONTEND_APP_NAME` | `ca-tickets-frontend` |
| `BACKEND_URL` | `https://ca-tickets-backend.proudrock-35e0b5da.australiaeast.azurecontainerapps.io` |
| `FRONTEND_URL` | `https://ca-tickets-frontend.proudrock-35e0b5da.australiaeast.azurecontainerapps.io` |

---

## Notes

- **No tests gate the deploy.** The `backend-csharp CI` and `frontend-tests-e2e`
  workflows are currently disabled (manual-only), so a push to `main` deploys
  without running them. Re-enable those (restore their `push`/`pull_request`
  triggers) and/or add `needs:` if you want deploys gated on green tests.
- The frontend's `NEXT_PUBLIC_*` values are **baked in at build time** (passed as
  Docker build args), so changing `BACKEND_URL`/`FRONTEND_URL` requires a
  re-deploy of the frontend to take effect.
- First-ever deploy: if the Container App / environment doesn't exist yet, the
  action creates it using `ACA_ENVIRONMENT` + `AZURE_REGION`.
