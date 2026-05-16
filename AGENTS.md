<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Heed deprecation notices and follow the established project patterns.

## Pinned Version (Verified by Easypanel success log)

- **Next.js**: `15.2.6` (Strictly Required)
- **React**: `19.0.0` (React 19)
- **Prisma**: `7.8.0` (with `@prisma/adapter-pg`)
- **Tailwind CSS**: `v4`

## Critical Breaking Changes (Next.js 15+)

### 1. Async Dynamic Route Parameters

In Next.js 15+, `params` in dynamic route handlers (`[id]`, `[slug]`, etc.) and layouts are now a **Promise**. You must `await` them before accessing properties.

```typescript
// ✅ CORRECT — Next.js 15.2.6 convention
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
}
```

### 2. Middleware & Auth Integration

- **Current State**: `src/middleware.ts` handles **both** Supabase Auth session refreshing and Auth.js (NextAuth) session protection for `/portal-rbac`.
- **Logic**: 
  1. `updateSession(req)` from Supabase is called first to refresh cookies.
  2. RBAC protection checks the `next-auth.session-token` (or `__Secure-` variant).
- **Do NOT** move RBAC logic out of middleware unless instructed; it is the current gatekeeper.

### 3. Configuration (Next.js 15+)

`outputFileTracingIncludes` is a top-level config property in `next.config.ts`.

```typescript
// ✅ next.config.ts
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "prisma", "@prisma/adapter-pg", "pg"],
  outputFileTracingIncludes: {
    "/": ["./prisma/**/*"],
  },
};
```

## Prisma 7 + pg Adapter (Singleton Pattern)

This project uses `@prisma/adapter-pg` with a raw `pg.Pool` (max 5 connections). 
- **Singleton**: Import `prisma` from `@/lib/prisma`.
- **Pool Management**: Avoid calling `prisma.$disconnect()` or `pool.end()` in standard request flows, as it will break subsequent requests with "Cannot use a pool after calling end".

## Common Troubleshooting (Memory for Agents)

### 1. Auth: UntrustedHost or MissingSecret
- Ensure `AUTH_TRUST_HOST=true` is set (automated in `src/lib/auth-rbac.ts`).
- Ensure `AUTH_SECRET` is defined in Easypanel/Env.
- If using a proxy, verify `NEXTAUTH_URL` matches the public domain.

### 2. Auth: Invalid Credentials (Email Normalization)
- `authorize()` in `src/lib/auth-rbac.ts` normalizes emails with `.toLowerCase().trim()`. 
- When creating users manually via SQL or Seed, ALWAYS store emails in lowercase.

### 3. API Security: Body Consumption
- Use `req.clone()` if you need to read the request body in a wrapper (like `withSecurity`) before passing it to the handler.

### 4. Prisma: Build Failures on CI/CD
- If Prisma fails to validate `DATABASE_URL` during `next build`, ensure the environment variable is available or provided as a dummy during build time.

## Build Output

- Output mode: `standalone`
- Runtime: `node server.js`
- Docker: Multi-stage with `node:22-alpine`
<!-- END:nextjs-agent-rules -->
