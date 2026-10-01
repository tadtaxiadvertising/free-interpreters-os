# Project Status — Free Interpreters OS

## 1. Project Current State (v3.6.0 - Enterprise Stabilized)

### ✅ Completed Milestones

- **RBAC Vault Architecture (v3.5.0)**: Implemented a secure, role-based access control portal using **Auth.js (NextAuth v5)** with dedicated workflows for Admin, Holder, and Interpreter.
- **Unified Middleware**: Integrated Supabase session refresh and Auth.js protection in a single `src/middleware.ts`.
- **Infrastructure Stabilization**: Resolved Prisma connection pool exhaustion and Auth.js host trust issues in production.
- **Security Hardening**: Implemented `withSecurity` wrapper with `req.clone()` to prevent "body already consumed" errors.
- **Enterprise Stabilization (v3.6.0)**: Complete enterprise-grade stabilization per skill spec:
  - **Auth Consolidation**: Single `CurrentActor` abstraction, removed `startsWith('c')` heuristic, removed auto-provisioning on reads
  - **Onboarding Unification**: Single canonical state (`user_profiles.onboarding_complete`), transactional writes, backfill migration
  - **Payment Domain Unification**: `BankFormRD` as single source of truth, masked summary in Settings, "Solicitar cambio" flow
  - **Ranking Privacy & Performance**: Private API for interpreters (own data only), admin API for full leaderboard, configurable weights via SystemConfig, SQL aggregation
  - **Presence Consolidation**: Unified contract (`type` vs `status`), state machine (Offline/Online/Away/Busy), separated `lastHeartbeat` vs `lastActivity`, fixed multi-tab
  - **Production & Payroll Hardening**: Partial unique index on active calls, atomic `endCall`, batch CSV import with `csv-parse`, fingerprint idempotency, unique constraint on manual logs
  - **Roleplay Audit**: XOR constraint at DB level, consolidated 3 duplicate migrations into 1
  - **Tests & CI/CD**: Vitest + React Testing Library, 28 passing tests, CI workflow with validation gate
  - **Documentation Alignment**: Version drift fixed (Next 15.2.6, React 19.0.0, Prisma 7.8.0)

### 🛠️ In-Progress / Ongoing

- **Vault Encryption**: Implementing field-level encryption for sensitive credentials in the database.
- **Admin Moderation**: Finalizing the message approval workflow between Holders and Admin.
- **Mobile Responsiveness**: Optimizing the RBAC Portal UI for mobile devices.

---

## 2. Known Issues & Resolutions

### 🔴 Problem: "Invalid credentials" during login

- **Cause**: Case sensitivity in emails or database connectivity errors.
- **Solution**: Normalization added in `auth-rbac.ts`. Ensure users are created with lowercase emails.

### 🔴 Problem: "Cannot use a pool after calling end"

- **Cause**: Calling `prisma.$disconnect()` or `pool.end()` in a singleton environment.
- **Solution**: Removed all explicit disconnect calls. Let the Node.js process handle the pool lifecycle.

### 🔴 Problem: "UntrustedHost" in Auth.js

- **Cause**: NextAuth v5 security check for host origin.
- **Solution**: Set `AUTH_TRUST_HOST=true` in environment or configuration.

### ✅ Resolved: Legacy API Sync

- **Status**: Fixed
- **Resolution**: The `interpreters-api` has been fully refactored to use the unified RBAC schema. The local schema has been synced, Prisma 7 compatibility issues (datasource URL) resolved, and the service now passes all TypeScript checks.

---

## 3. Environment Configuration

| Variable | Description | Recommended Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | URL of the Backend service | `http://localhost:3001` (local) |
| `DATABASE_URL` | Connection with Pooling (Port 6543) | `postgresql://...:6543/...` |
| `DIRECT_URL` | Connection for Migrations (Port 5432) | `postgresql://...:5432/...` |
| `AUTH_SECRET` | Required for Auth.js | Any secure string |

---

## 4. Developer Guidelines

1. **Routing**: Always `await params` in dynamic routes (`[id]`).
2. **Components**: For interactive buttons (modals, forms), use components from `src/components/` and ensure they have `'use client'`.
3. **API Security**: Use the `withSecurity` wrapper in `src/lib/api-security.ts` for all API routes.
4. **Data Access**: Always use the singleton `prisma` from `@/lib/prisma`.