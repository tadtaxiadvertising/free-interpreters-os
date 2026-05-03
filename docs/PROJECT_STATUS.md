# Project Status — Free Interpreters OS

## 1. Project Current State (v3.0.0)

### ✅ Completed Milestones

- **Framework Migration**: Upgraded to Next.js 16.2.4 and React 19.
- **Recruitment Pipeline (v0.2.0)**: Dashboard and candidate management implemented.
- **QA Module (v0.3.0)**: Integration of scorecards and quality metrics.
- **Payroll Engine & Verification (v0.4.0)**: Detailed records, incentives, and `verified_minutes` overrides implemented.
- **Architecture Stabilization**: Transitioned to **Direct Prisma Access** via Server Actions for all server-side operations to eliminate `EAI_AGAIN` DNS resolution errors.
- **Dominican Republic Banking**: Integrated mandatory fields for local banking and user profiles.
- **Auth & Onboarding**: Fully transitioned to **Supabase Auth** with a multi-step interactive onboarding wizard.
- **UI/UX Refactor**:
  - Migrated to **Tailwind CSS v4**.
  - Centralized session management in the `Navbar` profile menu.
  - Implemented real-time Ranking and Performance leaderboards.
- **Infrastructure**: Optimized for Easypanel with connection pooling (Port 6543) and Prisma singleton.

### 🛠️ In-Progress / Ongoing

- **Performance Optimization**: Refining SQL queries for large datasets in the Ranking view.
- **Service Cleanup**: Removing legacy internal `fetch()` calls from server components.
- **Database Integrity**: Ongoing audit of RLS policies for granular access control.

---

## 2. Environment Configuration

| Variable | Description | Recommended Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | URL of the Backend service | `http://localhost:3001` (local) |
| `DATABASE_URL` | Connection with Pooling (Port 6543) | `postgresql://...:6543/...` |
| `DIRECT_URL` | Connection for Migrations (Port 5432) | `postgresql://...:5432/...` |

---

## 3. Developer Guidelines

1. **Routing**: Always `await params` in dynamic routes (`[id]`).
2. **Components**: For interactive buttons (modals, forms), use components from `src/components/` and ensure they have `'use client'`.
3. **API**: Always use `fetch()` with `NEXT_PUBLIC_API_URL` when requesting data from the Roster or other backend modules.
