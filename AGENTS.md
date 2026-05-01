<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Pinned Version (Verified by Easypanel success log)

- **Next.js**: `16.2.4` (Strictly Required)
- **React**: `19.2.4`
- **Prisma**: `7.8.0` (with `@prisma/adapter-pg`)

## Critical Breaking Changes (vs. Next.js 15)

### 1. Async Dynamic Route Parameters

In Next.js 16+, `params` in dynamic route handlers (`[id]`, `[slug]`, etc.) are now a **Promise**. You must `await` them before accessing properties.

```typescript
// ❌ WRONG — will throw a runtime error
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id; // TypeError: Cannot read property 'id' of a Promise
}

// ✅ CORRECT — Next.js 16.2.4 convention
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
}
```

### 2. Middleware Deprecation

Based on the recent successful Easypanel deployment log, the traditional `middleware.ts` file is **deprecated** in favor of Next.js 16's new **proxy convention** for rewrite/redirect logic. The current implementation uses middleware exclusively for Supabase session refresh — not for proxying.

- **Current status**: `src/middleware.ts` is retained for Supabase Auth session management only.
- **Do NOT** add proxy rewrites or API forwarding logic to `middleware.ts`. Use `next.config.ts` `rewrites()` instead.

### 3. Configuration Changes

`outputFileTracingIncludes` is now a **top-level** config property in `next.config.ts`, no longer nested under `experimental`.

```typescript
// ✅ next.config.ts (Next.js 16+)
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "prisma", "@prisma/adapter-pg", "pg"],
  outputFileTracingIncludes: {
    "/": ["./prisma/**/*"],
  },
};
```

## Prisma 7 + pg Adapter

This project uses `@prisma/adapter-pg` with a raw `pg.Pool`. Do NOT initialize `PrismaClient` with a `datasourceUrl` — the adapter handles connection management.

```typescript
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

## Build Output

- Output mode: `standalone` (produces `server.js` + `.next/static`)
- Runtime command: `node server.js`
- Docker: multistage build with `node:22-alpine`
<!-- END:nextjs-agent-rules -->
