# Integrated Portal RBAC Synchronization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Synchronize the modern, HSL-tailored RBAC authentication, SHA-256 token-based password recovery, and lazy-initialized Prisma v7 singleton across the three deployment subfolders (`/interpreters`, `/administrador`, `/titular`) while enforcing strict role boundary routing and resolving the monorepo build errors.

**Architecture:** Sync the master `schema.prisma` and prisma client singleton to all subprojects and regenerate the client locally. Copy modern Server Actions and pages from `/src` to the subproject `src/` folders. Align root pages (`/app/page.tsx`) to redirect to `/portal-rbac/login` via Auth.js sessions. Enforce role-restrictions in each subproject's middleware, fixing the legacy `"OWNER"` vs `"HOLDER"` type mismatch.

**Tech Stack:** Next.js, Auth.js v5 (NextAuth v5), Prisma v7.8.0, PostgreSQL (pg), Tailwind CSS v4, TypeScript.

---

## Sync Tasks

### Task 1: Synchronize Prisma Schema and Regenerate Clients

Copy the master Prisma schema from the root folder to all subfolders and regenerate `@prisma/client` to make sure all subprojects have access to the `RbacUser` and `PasswordResetToken` models.

#### Files

- Create/Overwrite: `interpreters/prisma/schema.prisma`
- Create/Overwrite: `administrador/prisma/schema.prisma`
- Create/Overwrite: `titular/prisma/schema.prisma`

#### Step 1: Copy schema files using PowerShell

Write the execution steps to run copy commands and regenerate the Prisma clients.

Run:

```powershell
cp prisma/schema.prisma interpreters/prisma/schema.prisma
cp prisma/schema.prisma administrador/prisma/schema.prisma
cp prisma/schema.prisma titular/prisma/schema.prisma
```

#### Step 2: Generate clients in subfolders

Run the following commands sequentially:

```powershell
cd interpreters
npx prisma generate
cd ../administrador
npx prisma generate
cd ../titular
npx prisma generate
cd ..
```

Expected: Successfully generated the Prisma clients with the new `RbacUser` and `PasswordResetToken` models without errors.

#### Step 3: Commit changes

Run:

```bash
git add interpreters/prisma/schema.prisma administrador/prisma/schema.prisma titular/prisma/schema.prisma
git commit -m "chore: sync schema.prisma across all subprojects"
```

---

### Task 2: Sync Prisma Lazy Singleton and Actions

Copy the highly resilient, lazy-initialized Prisma singleton (`src/lib/prisma.ts`) and all server actions to all subfolders.

#### Files

- Create/Overwrite: `interpreters/src/lib/prisma.ts`
- Create/Overwrite: `administrador/src/lib/prisma.ts`
- Create/Overwrite: `titular/src/lib/prisma.ts`
- Copy directory contents from `src/app/actions` to:
  - `interpreters/src/app/actions`
  - `administrador/src/app/actions`
  - `titular/src/app/actions`

#### Step 1: Copy files via PowerShell

Run:

```powershell
cp src/lib/prisma.ts interpreters/src/lib/prisma.ts
cp src/lib/prisma.ts administrador/src/lib/prisma.ts
cp src/lib/prisma.ts titular/src/lib/prisma.ts

# Copy all server actions
Copy-Item -Path "src/app/actions\*" -Destination "interpreters/src/app/actions" -Recurse -Force
Copy-Item -Path "src/app/actions\*" -Destination "administrador/src/app/actions" -Recurse -Force
Copy-Item -Path "src/app/actions\*" -Destination "titular/src/app/actions" -Recurse -Force
```

#### Step 2: Verify copy completion

Verify the files are copied correctly and check that `interpreters/src/lib/prisma.ts` contains `getPrisma()`.

#### Step 3: Commit changes

Run:

```bash
git add interpreters/src/lib/prisma.ts administrador/src/lib/prisma.ts titular/src/lib/prisma.ts interpreters/src/app/actions administrador/src/app/actions titular/src/app/actions
git commit -m "feat: sync lazy prisma singleton and server actions to subprojects"
```

---

### Task 3: Sync Portal RBAC Pages and Layouts

Sync the complete UI pages (login, forgot-password, reset-password, and dashboards) to all subprojects to ensure the modern HSL design and SHA-256 recovery pages are unified.

#### Files

- Copy directory contents from `src/app/portal-rbac` to:
  - `interpreters/src/app/portal-rbac`
  - `administrador/src/app/portal-rbac`
  - `titular/src/app/portal-rbac`

#### Step 1: Copy directories via PowerShell

Run:

```powershell
Copy-Item -Path "src/app/portal-rbac\*" -Destination "interpreters/src/app/portal-rbac" -Recurse -Force
Copy-Item -Path "src/app/portal-rbac\*" -Destination "administrador/src/app/portal-rbac" -Recurse -Force
Copy-Item -Path "src/app/portal-rbac\*" -Destination "titular/src/app/portal-rbac" -Recurse -Force
```

#### Step 2: Commit changes

Run:

```bash
git add interpreters/src/app/portal-rbac administrador/src/app/portal-rbac titular/src/app/portal-rbac
git commit -m "feat: sync portal-rbac pages and layout structures to subprojects"
```

---

### Task 4: Align Root Page Redirections

Update `/app/page.tsx` in `/interpreters`, `/administrador`, and `/titular` to use Auth.js session verification and direct users strictly to `/portal-rbac/login` if unauthenticated, or to their respective dashboard on successful authentication.

#### Files

- Create/Overwrite: `interpreters/src/app/page.tsx`
- Create/Overwrite: `administrador/src/app/page.tsx`
- Create/Overwrite: `titular/src/app/page.tsx`

#### Step 1: Write the updated RootPage code

Replace `interpreters/src/app/page.tsx` with:

```typescript
import { auth } from "@/lib/auth-rbac";
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/portal-rbac/login');
  }

  const role = (session.user as any).role;
  if (role === 'INTERPRETER') {
    redirect('/portal-rbac/interpreter/dashboard');
  } else if (role === 'ADMIN') {
    redirect('/portal-rbac/admin/dashboard');
  } else if (role === 'HOLDER') {
    redirect('/portal-rbac/holder/dashboard');
  } else {
    redirect('/portal-rbac/login');
  }
}
```

Do the exact same for `administrador/src/app/page.tsx` and `titular/src/app/page.tsx`.

#### Step 2: Commit changes

Run:

```bash
git add interpreters/src/app/page.tsx administrador/src/app/page.tsx titular/src/app/page.tsx
git commit -m "fix: align root page redirections to use Auth.js instead of legacy Supabase"
```

---

### Task 5: Enforce STRICT Role Permissions in Titular Middleware

Update `titular/src/middleware.ts` to check role `"HOLDER"` instead of the legacy, non-existent `"OWNER"`.

#### Files

- Modify: `titular/src/middleware.ts:14-17`

#### Step 1: Replace line 15 in titular middleware

Modify the condition to check role `"HOLDER"` instead of `"OWNER"`:

```typescript
  // El servicio 'titular' solo permite el rol 'HOLDER'
  if (role !== "HOLDER" && pathname !== "/unauthorized") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }
```

#### Step 2: Commit changes

Run:

```bash
git add titular/src/middleware.ts
git commit -m "fix: update titular middleware to restrict strictly to HOLDER role"
```

---

### Task 6: Validate & Build Subprojects

Run typescript checks and full production builds inside each subproject to verify all compilation problems are resolved and standalone production bundles are ready.

#### Files

- Verify build of `/interpreters`
- Verify build of `/administrador`
- Verify build of `/titular`

#### Step 1: Build interpreters

Run:

```powershell
cd interpreters
npm run build
```

Expected: Successfully builds without type or module resolution errors.

#### Step 2: Build administrador

Run:

```powershell
cd ../administrador
npm run build
```

Expected: Successfully builds without type or module resolution errors.

#### Step 3: Build titular

Run:

```powershell
cd ../titular
npm run build
```

Expected: Successfully builds without type or module resolution errors.

#### Step 4: Return to root and complete

Run:

```powershell
cd ..
```

All monorepo subprojects are fully synchronized and compilation-safe.
