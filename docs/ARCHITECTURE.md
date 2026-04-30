# Architecture Specification — Free Interpreters OS v3

> **Architecture**: Decoupled Frontend + Backend API  
> **Runtime**: Easypanel (Docker/VPS) — Self-Hosted  
> **Auth**: Supabase Auth (native, no Clerk)  
> **Last Updated**: 2026-04-30

---

## 1. Technology Stack

| Layer       | Technology                            | Service           | Rationale                                    |
| :---------- | :------------------------------------ | :---------------- | :------------------------------------------- |
| Framework   | Next.js 16 (App Router)               | Both              | SSR/SSG + API Routes + Server Actions        |
| Auth        | Supabase Auth                         | Frontend (SSR)    | Native auth, RLS integration, free tier      |
| Database    | Supabase PostgreSQL                   | Backend only      | Managed Postgres, connection pooling         |
| ORM         | Prisma 7 + `@prisma/adapter-pg`       | Backend only      | Type-safe queries, ESM support               |
| Validation  | Zod v4                                | Both              | Runtime + compile-time type safety           |
| Styling     | Tailwind CSS v4 + Lucide Icons        | Frontend only     | Utility-first, tree-shakeable                |
| Deployment  | Easypanel (Docker on VPS)             | Both              | Self-hosted, webhook-driven CI/CD            |

## 2. Service Architecture

### 2.1 Service Boundary

| Service              | Repository              | Easypanel App        | Port | Responsibility                               |
| :------------------- | :---------------------- | :------------------- | :--- | :------------------------------------------- |
| **interpreters**     | `free-interpreters-os`  | `interpreters`       | 3000 | UI rendering, auth sessions, static assets   |
| **interpreters-api** | `interpreters-api`      | `interpreters-api`   | 4000 | Business logic, DB access, webhooks, payroll |

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

## 3. Authentication & Authorization (Supabase RBAC)

### Roles

| Role              | Permissions                                           |
| :---------------- | :---------------------------------------------------- |
| admin           | Full CRUD on all modules + payroll approval           |
| qa_auditor      | Read interpreters, CRUD on qa_scores                  |
| payroll_manager | Read interpreters/logs, manage payroll_records        |
| interpreter     | Read own profile, own logs, own QA scores, call timer |

### Middleware Flow (Frontend)

```text
Request → Supabase Middleware (SSR) → Session Refresh → Page Render
               │
               ├─ Public: /login, /register
               ├─ Interpreter: /dashboard/*
               └─ Admin: /admin/*, /payroll/*, /qa/*
```

### API Auth Flow (Backend)

```text
Request → CORS Check → Bearer Token Extraction → Supabase Token Verify → Route Handler
```

## 4. Caching Strategy

| Data Type        | Strategy          | TTL  | Invalidation                   |
| :--------------- | :---------------- | :--- | :----------------------------- |
| Interpreter List | ISR               | 60s  | `revalidatePath()` on mutation |
| Dashboard Stats  | ISR               | 120s | Time-based                     |
| QA Scores        | On-demand         | 0    | Always fresh                   |
| Payroll Records  | On-demand         | 0    | Always fresh (financial)       |
| System Config    | Server-side cache | 300s | Manual revalidation            |

## 5. Map of Services

1. **Interpreter Hub**: Master roster CRUD (Backend API).
2. **Production Telemetry**: CSV import + real-time call tracking (Backend API).
3. **QA Service**: Weighted evaluation forms with auto-fail logic (Backend API).
4. **Payroll Engine**: DB-side aggregation → transactional record creation (Backend API).
5. **Recruitment Pipeline**: Webhook-driven state machine for candidates (Backend API).
6. **Notification Service**: User-scoped alerts with read/unread state (Backend API).
7. **Frontend Shell**: SSR pages, auth sessions, UI components (Frontend).
