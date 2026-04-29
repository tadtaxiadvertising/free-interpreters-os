# Architecture Specification — Free Interpreters CRM v2

> **Migration**: Supabase → Neon.tech + Clerk Auth  
> **Runtime**: Vercel Hobby Plan ($0) + Edge Runtime  
> **Last Updated**: 2026-04-29

---

## 1. Technology Stack

| Layer           | Technology                            | Rationale                                       |
| :-------------- | :------------------------------------ | :---------------------------------------------- |
| Framework       | Next.js 16 (App Router)               | SSR/SSG + Server Actions + Edge Runtime         |
| Auth            | Clerk                                 | Free tier (10K MAU), RBAC, webhook sync         |
| Database        | Neon.tech PostgreSQL (Free)           | Serverless auto-scaling, HTTP driver, branching |
| ORM             | Prisma 7 + `@neondatabase/serverless` | Type-safe queries, connection pooling           |
| Validation      | Zod v4                                | Runtime + compile-time type safety              |
| Styling         | Tailwind CSS v4 + Lucide Icons        | Utility-first, tree-shakeable                   |
| Deployment      | Vercel Hobby Plan                     | Zero-cost, Edge Functions, automatic CI/CD      |

## 2. Vercel Hobby Plan Constraints

| Constraint         | Limit    | Mitigation Strategy                              |
| :----------------- | :------- | :----------------------------------------------- |
| Serverless Timeout | 10s      | DB-side aggregation via `fn_aggregate_payroll()` |
| Edge Timeout       | 25s      | Use Edge Runtime for auth middleware             |
| Bandwidth          | 100GB/mo | ISR + static pages for dashboards                |
| Builds             | 100/day  | Feature branches only deploy on merge            |
| Function Size      | 50MB     | Tree-shake Prisma, no heavy deps                 |

## 3. Database Architecture (Neon.tech)

### Connection Strategy

```text
┌─────────────┐     HTTPS (Neon HTTP Driver)     ┌──────────────┐
│  Edge Func   │ ─────────────────────────────── → │   Neon.tech   │
│  (Middleware) │                                  │  PostgreSQL   │
└─────────────┘                                   │  (Serverless) │
                                                  └──────────────┘
┌─────────────┐     WebSocket (Pooled, max=10)    ┌──────────────┐
│  Server      │ ─────────────────────────────── → │   Neon Pooler │
│  Actions     │    pgBouncer Transaction Mode     │  :5432        │
└─────────────┘                                   └──────────────┘
```

- **Edge Functions** (middleware, auth checks): Use `@neondatabase/serverless` HTTP driver — zero TCP overhead.
- **Server Actions** (CRUD, payroll): Use Prisma with pooled connection (`max: 10`, `idleTimeout: 30s`).
- **Payroll Aggregation**: Runs as PostgreSQL function `fn_aggregate_payroll()` — all math in DB, only result set returned to serverless function.

### Entity-Relationship Diagram

```text
┌──────────────────┐       1:N       ┌───────────────────┐
│  user_profiles    │───────────────→│   notifications    │
│  (Clerk RBAC)     │                └───────────────────┘
│                   │
│  clerk_id (UK)    │       1:1
│  role (ENUM)      │───────────────→┌───────────────────┐
│  interpreter_id?──│───────────────→│   interpreters     │
└──────────────────┘                 │   (Master Roster)  │
                                     │                    │
                         ┌───────────│   tariff_per_min   │───────────┐
                         │           └────────┬───────────┘           │
                         │ 1:N               │ 1:N                   │ 1:N
                         ▼                   ▼                       ▼
              ┌──────────────────┐  ┌────────────────┐   ┌───────────────────┐
              │ interpreter_     │  │ production_    │   │ call_sessions     │
              │ account_rates    │  │ logs           │   │ (Real-time)       │
              │                  │  │                │   │                   │
              │ tariff_per_hour  │  │ interpreted_   │   │ duration_seconds  │
              │ effective_from   │  │ minutes        │   │ tariff_snapshot   │
              │ effective_to     │  │ adherence      │   │ call_cost         │
              └──────────────────┘  └──────┬─────────┘   └───────────────────┘
                         │                 │ 1:1
                         │                 ▼
                         │        ┌────────────────┐
                         │        │ qa_scores      │
                         │        │                │
                         │        │ total_score    │
                         │        │ critical_error │
                         │        └────────────────┘
                         │
                         └──────→ ┌────────────────┐
                                  │ accounts       │
                                  │ (Clients)      │
                                  └────────────────┘

              ┌──────────────────┐        ┌──────────────────┐
              │ payroll_records  │        │ payrate_audit_log │
              │                  │        │                   │
              │ gross_total      │        │ old_rate          │
              │ quality_bonus    │        │ new_rate          │
              │ net_total        │        │ changed_by        │
              │ approved_by      │        └──────────────────┘
              └──────────────────┘

              ┌──────────────────┐        ┌──────────────────┐
              │ recruitment_     │        │ system_configs    │
              │ candidates       │        │ (Key-Value)       │
              └──────────────────┘        └──────────────────┘
```

## 4. Authentication & Authorization (Clerk RBAC)

### Roles

| Role              | Permissions                                           |
| :---------------- | :---------------------------------------------------- |
| `admin`           | Full CRUD on all modules + payroll approval           |
| `qa_auditor`      | Read interpreters, CRUD on qa_scores                  |
| `payroll_manager` | Read interpreters/logs, manage payroll_records        |
| `interpreter`     | Read own profile, own logs, own QA scores, call timer |

### Middleware Flow

```text
Request → Clerk Middleware (Edge) → Role Check → Route Handler
                  │
                  ├─ Public routes: /login, /register, /api/webhooks/*
                  ├─ Interpreter routes: /dashboard/*
                  └─ Admin routes: /admin/*, /payroll/*, /qa/*
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

1. **Interpreter Hub**: Master roster CRUD with Clerk-synced profiles.
2. **Production Telemetry**: CSV import + real-time call tracking.
3. **QA Service**: Weighted evaluation forms with auto-fail logic.
4. **Payroll Engine**: DB-side aggregation → transactional record creation.
5. **Recruitment Pipeline**: Webhook-driven state machine for candidates.
6. **Notification Service**: User-scoped alerts with read/unread state.
