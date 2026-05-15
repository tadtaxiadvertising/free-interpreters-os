# Project Status — Free Interpreters OS

## 1. Project Current State (v3.0.0)

### ✅ Completed Milestones

- **RBAC Vault Architecture (v3.5.0)**: Implemented a secure, role-based access control portal using **Auth.js (NextAuth v5)** with dedicated workflows for Admin, Holder, and Interpreter.
- **Data Isolation & Security**: Established strict data isolation for vault credentials and integrated Zod-based validation across all portal actions.
- **Dual-Auth Middleware**: Configured unified middleware to handle both Supabase Auth (legacy/main) and Auth.js (portal) sessions.

### 🛠️ In-Progress / Ongoing

- **Vault Encryption**: Implementing field-level encryption for sensitive credentials in the database.
- **Admin Moderation**: Finalizing the message approval workflow between Holders and Admin.
- **Mobile Responsiveness**: Optimizing the RBAC Portal UI for mobile devices.

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
