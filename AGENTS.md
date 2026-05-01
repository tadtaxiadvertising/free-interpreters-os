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

### 3.2 Middleware → Proxy Transition

As documented in the Next.js 16 specifications and verified by our deployment logs, the `middleware.ts` convention is deprecated.

- **Current State**: `src/middleware.ts` handles **only** Supabase Auth session refreshing.
- **Future State**: All interceptor logic should move to the **Proxy** layer.
- **Rewrites**: All API forwarding and URL masking must reside in `next.config.ts` `rewrites()`. This ensures the standalone build routes traffic correctly through the Node.js server.
- **Edge Logic**: Move to the `proxy` directory if required by your version, or keep `src/middleware.ts` **ONLY** for Supabase session management as per our current stable build.
- **Do NOT** add business logic or API proxying to `src/middleware.ts`. This will trigger deployment warnings and potential 502s on Easypanel.

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
