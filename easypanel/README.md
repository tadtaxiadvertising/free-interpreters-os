# Easypanel Deployment & Environment Configuration

This directory contains the necessary configuration details for deploying the **Free Interpreters OS** on an Easypanel-managed VPS.

> **Easypanel instance**: `rewvid.easypanel.host`  
> **Custom domains** (`freeinterpreters.com`) are not yet configured — services are accessible via Easypanel subdomains.

---

## Environment Variables

Easypanel requires these variables to be configured in the **Environment** tab of your application settings.

> **Important**: Sensitive vars (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`) must be set as **runtime env vars** in Easypanel, NOT as build args. The Dockerfile runner stage does not inherit builder build-arg env vars.

### 1. Supabase Client Configuration

| Variable                        | Description                                     | Scope     | Example                               |
| :------------------------------ | :---------------------------------------------- | :-------- | :------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | REST API endpoint for your Supabase project.    | Build+RT  | `https://your-id.supabase.co`         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous public key for client-side requests.  | Build+RT  | `eyJhbGciOiJIUz...`                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Service role secret key for admin operations.   | Runtime   | `eyJhbGciOiJIUz...`                   |

> The anon key must start with `eyJ` — placeholder keys like `sb_publishable_...` are **invalid** and return HTTP 401.

### 2. Database Configuration (Prisma)

| Variable       | Description                                              | Scope     | Example                                                |
| :------------- | :------------------------------------------------------- | :-------- | :----------------------------------------------------- |
| `DATABASE_URL` | **RUNTIME**: Points to Pooler (port 6543).               | Runtime   | `postgresql://postgres.[id]:[pass]@pooler.com:6543/db` |
| `DIRECT_URL`   | **MIGRATIONS**: Direct connection (port 5432).           | Runtime   | `postgresql://postgres.[id]:[pass]@direct.com:5432/db` |

### 3. Auth & Security Configuration

| Variable          | Description                                    | Scope     | Example                                             |
| :---------------- | :--------------------------------------------- | :-------- | :-------------------------------------------------- |
| `AUTH_SECRET`     | NextAuth/Auth.js session encryption key.       | Runtime   | `a1b2c3d4e5f6...`                                   |
| `ENCRYPTION_KEY`  | 32-byte hex key for data encryption.           | Runtime   | `0123456789abcdef0123456789abcdef...`               |

### 4. Application Configuration

| Variable              | Description                                             | Scope     | Example                                  |
| :-------------------- | :------------------------------------------------------ | :-------- | :--------------------------------------- |
| `NODE_ENV`            | Sets application environment (production/development).  | Runtime   | `production`                             |
| `NEXT_PUBLIC_API_URL` | **SYNC**: Public URL of the backend API service.        | Build+RT  | `https://database-interpreters.rewvid.easypanel.host/` |

---

## Two Services

The project deploys **two separate services** on Easypanel:

| Service              | Description            | Build                     |
| :------------------- | :--------------------- | :------------------------ |
| `interpreters`       | Next.js frontend       | Dockerfile (multi-stage)  |
| `interpreters-api`   | Backend API            | Dockerfile (multi-stage)  |

Each service has its own **webhook URL** for triggering deployments via GitHub Actions.

---

## EasyPanel Deployment Steps

1. **Create Services:** Create two "App" services in Easypanel dashboard (`interpreters` + `interpreters-api`).
2. **Source:** Connect the `free-interpreters-os` GitHub repository to each service.
3. **Build:** Use `Dockerfile` at root with context `.`.
4. **Env:** Copy variables from the tables above to the **Environment** tab. Mark sensitive vars as runtime-only.
5. **Domains:** Map your public domain (e.g., `interpreters.rewvid.easypanel.host`) or configure custom domains later.
6. **Webhooks:** Copy webhook URLs from each service's Settings → Webhook section. Store them as GitHub Secrets (see below).
7. **Deploy:** Execute initial deployment.

---

## GitHub Secrets for Auto-Deploy

The `.github/workflows/deploy.yml` workflow requires two GitHub repository secrets:

| Secret Name                      | Value                                                       | How to get it                                            |
| :------------------------------- | :---------------------------------------------------------- | :------------------------------------------------------- |
| `EASYPANEL_WEBHOOK_INTERPRETERS` | Webhook URL for `interpreters` service                      | Easypanel → `interpreters` service → Settings → Webhook  |
| `EASYPANEL_WEBHOOK_API`          | Webhook URL for `interpreters-api` service                  | Easypanel → `interpreters-api` service → Settings → Webhook |

### Setting Secrets via `gh` CLI

```bash
# 1. Authenticate first:
gh auth login

# 2. Set each secret (paste the webhook URL when prompted):
gh secret set EASYPANEL_WEBHOOK_INTERPRETERS -R tadtaxiadvertising/free-interpreters-os
gh secret set EASYPANEL_WEBHOOK_API -R tadtaxiadvertising/free-interpreters-os

# 3. Verify secrets exist:
gh secret list -R tadtaxiadvertising/free-interpreters-os
```

### Setting Secrets via GitHub UI

1. Go to `github.com/tadtaxiadvertising/free-interpreters-os` → **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret**.
3. Add `EASYPANEL_WEBHOOK_INTERPRETERS` with the interpreters webhook URL.
4. Add `EASYPANEL_WEBHOOK_API` with the interpreters-api webhook URL.

> Webhook URL format: `https://rewvid.easypanel.host/api/deploy/webhook/<PROJECT_ID>/<SERVICE_ID>`

---

## Monitoring & Logs

- **Resource Usage:** Run `docker stats` in the Easypanel terminal.
- **App Health:** Check the "Logs" tab for real-time output.
- **Network:** App listens on internal port `3000`.
- **Deploy Logs:** GitHub Actions → workflow runs → check "Deploy interpreters" and "Deploy interpreters-api" jobs.
