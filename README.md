# Free Interpreters OS

> Internal CRM platform for managing interpreters, production tracking, QA audits, payroll, and recruitment.

## Architecture

This platform uses a **decoupled two-service architecture**:

| Service | Description | Tech |
| :------ | :---------- | :--- |
| `interpreters` (Frontend) | User interface, auth sessions, SSR pages | Next.js 16, Supabase Auth, Tailwind CSS v4 |
| `interpreters-api` (Backend) | REST API, business logic, database access | Next.js 16 API Routes, Prisma 7, PostgreSQL |

### Dual-Service Synchronization in Easypanel

In this decoupled approach:

1. **Service Provider (`interpreters-api`)**: This acts as the backend source of truth. It holds the Prisma Client and the actual connection to the Supabase database (`DATABASE_URL`).
2. **Service Consumer (`interpreters` Frontend)**: The frontend application that consumes the API data and handles UI rendering.

**Environment Variable Exchange**:

To correctly link both services in Easypanel:

- The **Frontend** must configure the `NEXT_PUBLIC_API_URL` environment variable to point to the public domain of the Backend service (e.g., `https://api.freeinterpreters.com`).
- The **Backend** must configure the `CORS_ORIGIN` environment variable to accept requests from the Frontend's public domain (e.g., `https://app.freeinterpreters.com`).
- Both services require their respective `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to authenticate users, but only the Backend handles `DATABASE_URL`.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for full architecture diagrams.

## Repository Structure

```text
free-interpreters-os/          ← This repo (Frontend)
├── src/app/                   # Pages and layouts
├── src/components/            # React UI components
├── src/lib/                   # Auth bridge, utilities
├── docs/                      # Architecture & API specs
├── documentation/             # Corporate SOPs & templates
├── prisma/                    # Schema reference (read-only)
├── Dockerfile                 # Frontend production build
└── easypanel/                 # Deployment documentation

interpreters-api/              ← Separate repo (Backend)
├── src/app/api/               # REST endpoints
├── src/app/actions/           # Server Actions
├── src/lib/prisma.ts          # Database client
├── src/services/              # Business logic
├── prisma/                    # Schema + migrations (owner)
└── Dockerfile                 # Backend production build
```

## Getting Started

### Frontend (this repo)

```bash
cp .env.example .env          # Fill in values
npm install
npm run dev                    # http://localhost:3001
```

### Backend (interpreters-api repo)

```bash
cp .env.example .env          # Fill in values
npm install
npx prisma generate
npm run dev                    # http://localhost:4000
```

## Deployment

Both services deploy to **Easypanel** via GitHub webhook on push to `main`.  
See [easypanel/README.md](./easypanel/README.md) for configuration details.

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) — System design & service boundaries
- [API Specification](./docs/API_SPEC.md) — REST endpoints (Backend)
- [Data Model](./docs/DATA_MODEL.md) — Database schema reference
- [Business Logic](./docs/BUSINESS_LOGIC.md) — Payroll, QA, recruitment rules
- [Corporate Docs](./documentation/README.md) — SOPs, templates, strategic docs
