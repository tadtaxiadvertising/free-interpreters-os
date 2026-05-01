# Project Status — Free Interpreters OS

## 1. Project Current State (v3.0.0)

### ✅ Completed Milestones

- **Framework Migration**: Upgraded to Next.js 16.2.4 and React 19.
- **Recruitment Pipeline (v0.2.0)**: Dashboard and candidate management implemented.
- **QA Module (v0.3.0)**: Integration of scorecards and quality metrics.
- **Payroll Engine Expansion (v0.4.0)**: Detailed records and deductions implemented.
- **Architecture Decoupling**: Frontend now consumes Backend logic via REST API (`/api/*`) instead of direct DB access where specified.
- **Auth Migration**: Fully transitioned from Clerk to native **Supabase Auth**.
- **UI/UX Refactor**:
  - Migrated to **Tailwind CSS v4**.
  - Removed redundant "Sign Out" buttons in headers/sidebars.
  - Centralized session management in the `Navbar` profile menu.
  - Improved dashboard grid responsiveness and metric alignment.
- **API Modernization**: Implemented async `params` for all dynamic routes.
- **Infrastructure**: Optimized for Easypanel with connection pooling (Port 6543).

### 🛠️ In-Progress / Ongoing

- **Service Separation**: Physical separation of frontend and backend repositories (currently co-located but conceptually decoupled).
- **Interactivity Restoration**: Converting server components to client components where user interaction is required (e.g., "Add Interpreter" button).
- **Database Validation**: Ensuring `prisma db push` consistency across environments.

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
