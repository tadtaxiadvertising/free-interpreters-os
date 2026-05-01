# Easypanel Deployment & Environment Configuration

This directory contains the necessary configuration details for deploying the **Free Interpreters OS** on an Easypanel-managed VPS.

## Environment Variables

Easypanel requires these variables to be configured in the **Environment** tab of your application settings.

### 1. Supabase Client Configuration

These variables connect the frontend application to your Supabase project. They can be found in your Supabase Dashboard under **Project Settings > API**.

| Variable                        | Description                                                 | Example                               |
| :------------------------------ | :---------------------------------------------------------- | :------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | The REST API endpoint for your Supabase project.            | `https://your-project-id.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anonymous public key used for client-side API requests. | `eyJhbGciOiJIUz...`                   |

### 2. Database Configuration (Prisma)

These variables configure Prisma to connect to your PostgreSQL database hosted on Supabase. They can be found in your Supabase Dashboard under **Project Settings > Database**.

> **⚠️ Important Distinction:** We use two different connection URLs because Prisma requires a direct connection for migrations, but should use a connection pooler for runtime operations.

| Variable       | Description                                                                                                                                                                                                                           | Example                                                                                          |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Used at **RUNTIME**. This should point to the "Transaction Mode" Pooler (usually port `6543`) to handle multiple concurrent connections efficiently. Append `?pgbouncer=true` if using the Prisma default driver.                     | `postgresql://postgres.[id]:[pass]@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL`   | Used for **MIGRATIONS** only. This is a Direct / Session Mode connection (usually port `5432`). It bypasses the pooler.                                                                                                               | `postgresql://postgres.[id]:[pass]@aws-0-region.pooler.supabase.com:5432/postgres`                |

### 3. Application Configuration

| Variable   | Description                                                                                                   | Example      |
| :--------- | :------------------------------------------------------------------------------------------------------------ | :----------- |
| `NODE_ENV` | Sets the application environment. For EasyPanel, this is automatically set, but it's good practice to define it. | `production` |

## EasyPanel Deployment Steps

1. **Create New Project/App:** In your EasyPanel dashboard, create a new "App".
2. **Source:** Select "GitHub" (or your Git provider) and connect the `free-interpreters-os` repository.
3. **Build Configuration:**
   - **Docker Context:** `.`
   - **Dockerfile Path:** `Dockerfile`
4. **Environment Variables:** Copy the variables from the tables above into the "Environment" tab.
5. **Domains:** Configure your public domain (e.g., `app.freeinterpreters.com`) and ensure it points to your VPS IP.
6. **Deploy:** Click "Deploy" to start the initial build.

## Monitoring & Logs

- **Terminal:** Use the built-in terminal in Easypanel to run `docker stats` for resource monitoring.
- **Logs:** View real-time application logs in the "Logs" tab of your service.
- **Port:** Ensure the app is listening on port `3000` (internal) and mapped correctly by the Easypanel proxy.
