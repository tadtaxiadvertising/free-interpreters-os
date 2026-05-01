# Architecture Specification — Free Interpreters OS v3

> **Architecture**: Decoupled Frontend + Backend API
> **Runtime**: Easypanel (Docker/VPS) — Self-Hosted
> **Auth**: Supabase Auth (native, no Clerk)
> **Framework**: Next.js 16.2.4 (both services - strictly required per deployment log)
> **Last Updated**: 2026-04-30

---

## 1. Technology Stack

| Layer       | Technology                            | Version  | Service           | Rationale                                    |
| :---------- | :------------------------------------ | :------- | :---------------- | :------------------------------------------- |
| Framework   | Next.js (App Router)                  | 16.2.4   | Both              | SSR/SSG + API Routes + Server Actions        |
| Runtime     | React                                 | 19.2.4   | Both              | Concurrent features, Server Components       |
| Auth        | Supabase Auth                         | 2.105.1  | Frontend (SSR)    | Native auth, RLS integration, free tier      |
| Database    | Supabase PostgreSQL                   | —        | Backend only      | Managed Postgres, connection pooling         |
| ORM         | Prisma + `@prisma/adapter-pg`         | 7.8.0    | Backend only      | Type-safe queries, ESM support, pg adapter   |
| Validation  | Zod                                   | 4.3.6    | Both              | Runtime + compile-time type safety           |
| Styling     | Tailwind CSS + Lucide Icons           | v4       | Frontend only     | Utility-first, tree-shakeable                |
| Deployment  | Easypanel (Docker on VPS)             | —        | Both              | Self-hosted, webhook-driven CI/CD            |

## 2. Service Architecture

### 2.1 Service Boundary

| Service              | Repository              | Easypanel App        | Port | Build Output   | Responsibility                               |
| :------------------- | :---------------------- | :------------------- | :--- | :------------- | :------------------------------------------- |
| **interpreters**     | `free-interpreters-os`  | `interpreters`       | 3000 | standalone     | UI rendering, auth sessions, static assets   |
| **interpreters-api** | `interpreters-api`      | `interpreters-api`   | 4000 | standalone     | Business logic, DB access, webhooks, payroll |

### 2.2 Communication Flow

```text
┌──────────────┐   HTTPS (fetch)    ┌──────────────────┐   TCP/pgBouncer   ┌──────────────┐
│  Browser      │ ──────────────── → │  interpreters     │                   │              │
│  (User)       │ ← ──────────────── │  (Frontend:3000)  │                   │              │
└──────────────┘   HTML/JSON         └────────┬─────────┘                   │              │
                                              │                             │   Supabase   │
                                    fetch()   │  NEXT_PUBLIC_API_URL        │   PostgreSQL │
                                              ▼                             │              │
                                     ┌──────────────────┐   Prisma/pg      │              │
                                     │  interpreters-api │ ───────────────→ │              │
                                     │  (Backend:4000)   │                  │              │
                                     └──────────────────┘                   └──────────────┘
```

- **Frontend → Backend**: All data operations go through `NEXT_PUBLIC_API_URL` (e.g., `https://api.freeinterpreters.com`).
- **Backend → Database**: Only `interpreters-api` holds `DATABASE_URL` and Prisma Client.
- **Auth**: Supabase Auth tokens are forwarded from Frontend to Backend via `Authorization: Bearer <token>` headers. The Backend validates them server-side using Supabase Admin SDK or token introspection.

### 2.3 Database Connection Strategy

```text
┌─────────────────┐   Transaction Pool (port 6543)   ┌──────────────┐
│ interpreters-api │ ──────────────────────────────→  │  Supabase    │
│ (Runtime)        │   DATABASE_URL + pgBouncer       │  Pooler      │
└─────────────────┘                                   └──────────────┘

┌─────────────────┐   Direct Session (port 5432)      ┌──────────────┐
│ prisma migrate   │ ──────────────────────────────→  │  Supabase    │
│ (CI/CD only)     │   DIRECT_URL                     │  Direct DB   │
└─────────────────┘                                   └──────────────┘
```

> **Memory Constraint**: The Easypanel VPS allocates ~457 MB to the API container. The `pg.Pool` is configured with `max: 20` connections and `connectionTimeoutMillis: 2000` to stay within budget. Always use port **6543** (transaction pooler) for `DATABASE_URL` in production.

## 3. Breaking Changes Log (Next.js 16.2.4)

### 3.1 Async Dynamic Route Parameters

In Next.js 16+, `params` in dynamic API route handlers are delivered as a **Promise**. All `[id]`-style routes must `await params` before accessing fields.

```typescript
// ✅ Required pattern for all dynamic routes
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = parseInt(resolvedParams.id, 10);
  // ...
}
```

### 3.2 Middleware Convention

As documented by the successful Easypanel deployment logs, the traditional `middleware.ts` file is **deprecated for proxy/rewrite logic** in Next.js 16. The current implementation at `src/middleware.ts` is retained **exclusively** for Supabase session refresh. Proxy rules (API forwarding, URL rewrites) must use the new proxy convention via `next.config.ts` `rewrites()`.

### 3.3 Configuration Surface

`outputFileTracingIncludes` has been promoted from `experimental` to a top-level property in `next.config.ts`. The `serverExternalPackages` property replaces `experimental.serverComponentsExternalPackages`.

## 4. Authentication & Authorization (Supabase RBAC)

### Roles

| Role              | Permissions                                           |
| :---------------- | :---------------------------------------------------- |
| admin             | Full CRUD on all modules + payroll approval           |
| qa_auditor        | Read interpreters, CRUD on qa_scores                  |
| payroll_manager   | Read interpreters/logs, manage payroll_records        |
| interpreter       | Read own profile, own logs, own QA scores, call timer |

### Middleware Flow (Frontend)

```text
Request → Supabase Middleware (SSR) → Session Refresh → Page Render
               │
               ├─ Public: /login, /register, /api/health
               ├─ Interpreter: /dashboard/*
               └─ Admin: /admin/*, /payroll/*, /qa/*
```

> **Note**: The middleware gracefully degrades if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing at runtime — it logs a warning and passes the request through instead of crashing the container with a 502.

### API Auth Flow (Backend)

```text
Request → CORS Check → Bearer Token Extraction → Supabase Token Verify → Route Handler
```

## 5. Caching Strategy

| Data Type        | Strategy          | TTL  | Invalidation                   |
| :--------------- | :---------------- | :--- | :----------------------------- |
| Interpreter List | ISR               | 60s  | `revalidatePath()` on mutation |
| Dashboard Stats  | ISR               | 120s | Time-based                     |
| QA Scores        | On-demand         | 0    | Always fresh                   |
| Payroll Records  | On-demand         | 0    | Always fresh (financial)       |
| System Config    | Server-side cache | 300s | Manual revalidation            |

## 6. Map of Services

1. **Interpreter Hub**: Master roster CRUD (Backend API).
2. **Production Telemetry**: CSV import + real-time call tracking (Backend API).
3. **QA Service**: Weighted evaluation forms with auto-fail logic (Backend API).
4. **Payroll Engine**: DB-side aggregation → transactional record creation (Backend API).
5. **Recruitment Pipeline**: Webhook-driven state machine for candidates (Backend API).
6. **Notification Service**: User-scoped alerts with read/unread state (Backend API).
7. **Frontend Shell**: SSR pages, auth sessions, UI components (Frontend).
