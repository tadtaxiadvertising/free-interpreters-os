# Architecture Specification

## 1. Technology Stack

- **Frontend/Backend:** Next.js 16.x (App Router API Routes)
- **Database:** PostgreSQL (Hosted on Supabase)
- **ORM:** Prisma Client (v7.x)
- **Styling:** Tailwind CSS v4, Lucide React
- **Deployment Target:** Vercel (Hobby Plan)

## 2. Serverless Constraints & Optimizations (Vercel Hobby Plan)

To ensure reliability under the Vercel Hobby Plan, the architecture is designed around the following constraints:

- **Execution Timeout:** Max 10 seconds per Serverless Function request.
- **Cold Starts:** APIs must initialize efficiently. Large external dependencies will be kept to a minimum.
- **Stateless Execution:** No in-memory cache between requests; all state resides in the Supabase database.

## 3. Database Connection Pooling

Since Serverless functions spin up and down constantly, direct connections to PostgreSQL can rapidly exhaust the database connection limit.

- **Strategy:** We use **Supabase Connection Pooling** (Supavisor/PgBouncer) in `Transaction` mode.
- **Implementation:** The Prisma connection string must use the pooler URL with `?pgbouncer=true`.
- **Query Optimization:** Transactions must be atomic and extremely short-lived to free up the pool immediately.

## 4. Map of Services

1. **Recruitment Engine:** Receives applicant data (e.g., via webhooks from forms), scores roleplays, and tracks the hiring pipeline.
2. **Interpreter Hub:** Master roster managing active, inactive, and in-training interpreters.
3. **Production Telemetry:** Ingests daily connection metrics (minutes interpreted, calls attended).
4. **QA Service:** Evaluates performance against standard weights.
5. **Payroll Engine:** Cross-references `Production Telemetry`, `Interpreter Hub` (tariffs), and `QA Service` (bonuses/penalties) to generate `PayrollRecords`.
