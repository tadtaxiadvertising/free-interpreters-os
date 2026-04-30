# Free Interpreters OS - EasyPanel Deployment

This guide explains how to deploy the Free Interpreters OS application to EasyPanel, focusing specifically on environment variables and project setup.

## Prerequisites
- An active EasyPanel instance installed on a VPS.
- A Supabase project set up for the database and authentication.
- Access to the Free Interpreters OS repository.

## Environment Variables

When setting up the project in EasyPanel, you must provide the following environment variables in the "Environment" tab of your application settings. These map directly to the `.env` configuration.

### 1. Supabase Client Configuration
These variables connect the frontend application to your Supabase project. They can be found in your Supabase Dashboard under **Project Settings > API**.

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | The REST API endpoint for your Supabase project. | `https://your-project-id.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anonymous public key used for client-side API requests. | `eyJhbGciOiJIUz...` |

### 2. Database Configuration (Prisma)
These variables configure Prisma to connect to your PostgreSQL database hosted on Supabase. They can be found in your Supabase Dashboard under **Project Settings > Database**.

> **⚠️ Important Distinction:** We use two different connection URLs because Prisma requires a direct connection for migrations, but should use a connection pooler for runtime operations.

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Used at **RUNTIME**. This should point to the "Transaction Mode" Pooler (usually port `6543`) to handle multiple concurrent connections efficiently. Append `?pgbouncer=true` if using the Prisma default driver. | `postgresql://postgres.[id]:[pass]@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Used for **MIGRATIONS** only. This is a Direct / Session Mode connection (usually port `5432`). It bypasses the pooler. | `postgresql://postgres.[id]:[pass]@aws-0-region.pooler.supabase.com:5432/postgres` |

### 3. Application Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Sets the application environment. For EasyPanel, this is automatically set, but it's good practice to define it. | `production` |

## EasyPanel Deployment Steps

1. **Create New Project/App:** In your EasyPanel dashboard, create a new "App".
2. **Source:** Select "GitHub" (or your Git provider) and connect the `free-interpreters-os` repository.
3. **Build Configuration:**
   - EasyPanel uses Nixpacks or Dockerfile. If we provide a `Dockerfile`, select Docker as the build method.
   - If using Nixpacks, the build commands are automatically detected (`npm run build`).
4. **Environment Variables:**
   - Go to the **Environment** tab.
   - Paste all the variables defined above.
   - **Save** the environment variables.
5. **Deploy:** Click the "Deploy" button. EasyPanel will pull the code, build the Next.js app, and start the container.

## Troubleshooting

- **Prisma Initialization Errors:** If the build fails with Prisma errors, ensure that `DATABASE_URL` is correctly formatted and accessible during build time (if using `prisma generate` during build).
- **Database Connection Issues:** Verify that the `DATABASE_URL` points to port `6543` (pooler) and `DIRECT_URL` points to port `5432` (direct). Supabase IPv4 deprecation requires using the connection pooler.
