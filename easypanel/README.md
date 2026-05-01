# Easypanel Deployment & Environment Configuration

This directory contains the necessary configuration details for deploying the **Free Interpreters OS** on an Easypanel-managed VPS.

## Environment Variables

Easypanel requires these variables to be configured in the **Environment** tab of your application settings.

### 1. Supabase Client Configuration

| Variable                        | Description                                     | Example                               |
| :------------------------------ | :---------------------------------------------- | :------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | REST API endpoint for your Supabase project.    | `https://your-id.supabase.co`         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous public key for client-side requests.  | `eyJhbGciOiJIUz...`                   |

### 2. Database Configuration (Prisma)

| Variable       | Description                                              | Example                                                |
| :------------- | :------------------------------------------------------- | :----------------------------------------------------- |
| `DATABASE_URL` | **RUNTIME**: Points to Pooler (port 6543).               | `postgresql://postgres.[id]:[pass]@pooler.com:6543/db` |
| `DIRECT_URL`   | **MIGRATIONS**: Direct connection (port 5432).           | `postgresql://postgres.[id]:[pass]@direct.com:5432/db` |

### 3. Application Configuration

| Variable              | Description                                             | Example                            |
| :-------------------- | :------------------------------------------------------ | :--------------------------------- |
| `NODE_ENV`            | Sets application environment (production/development).  | `production`                       |
| `NEXT_PUBLIC_API_URL` | **SYNC**: Public URL of the backend API service.        | `https://api.freeinterpreters.com` |

## EasyPanel Deployment Steps

1. **Create App:** Create a new "App" in Easypanel dashboard.
2. **Source:** Connect the `free-interpreters-os` GitHub repository.
3. **Build:** Use `Dockerfile` at root with context `.`.
4. **Env:** Copy variables from the tables above to the "Environment" tab.
5. **Domains:** Map your public domain (e.g., `app.freeinterpreters.com`).
6. **Deploy:** Execute initial deployment.

## Monitoring & Logs

- **Resource Usage:** Run `docker stats` in the Easypanel terminal.
- **App Health:** Check the "Logs" tab for real-time output.
- **Network:** App listens on internal port `3000`.
