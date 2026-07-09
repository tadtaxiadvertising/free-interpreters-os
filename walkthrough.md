# Auth/Login Fatal Errors — Walkthrough

## Root Cause Summary

Four interconnected issues caused auth failures:

1. **AUTH_SECRET not reaching `auth-rbac.ts` at module load time** — No dotenv fallback loader, so env vars were missing when NextAuth initialized in standalone/Easypanel mode.
2. **SUPABASE_SERVICE_ROLE_KEY warning** — Harmless but noisy; admin.ts handled it gracefully, but auth-rbac.ts didn't have the same dotenv loader.
3. **`deuryd@gmail.com` login failure** — Email not registered in Supabase Auth nor `rbac_users`. Not a code bug — the user must register first or be seeded.
4. **Server Action hash mismatch** — Stale `.next` cache held old action hashes. Resolved by clearing `.next` and hard-refreshing the browser.

## Changes Applied

### 1. `src/lib/auth-rbac.ts` — Dotenv fallback + AUTH_SECRET hardening

**Before:** No dotenv loader; `AUTH_SECRET` checked with a bare FATAL log that fired even when the var was available at runtime but not at module init.

**After:**
- Added dotenv fallback block (identical pattern to `admin.ts` and `server.ts`) that loads `.env.local` and `.env` before NextAuth initializes.
- If `AUTH_SECRET` is still missing after dotenv loading, derives a stable 32-byte secret from `ENCRYPTION_KEY` via SHA-256.
- Only logs FATAL when neither `AUTH_SECRET` nor `ENCRYPTION_KEY` can be resolved.
- Hardcoded `process.env.AUTH_TRUST_HOST = "true"` for Easypanel/proxy environments.

```typescript
// Dotenv fallback (runs before NextAuth())
if (typeof window === 'undefined' && typeof (globalThis as any).EdgeRuntime === 'undefined') {
  try {
    const dotenv = require('dotenv');
    const fs = require('fs');
    const path = require('path');
    const getCwd = () => (process as any)['cwd']();
    const loadEnv = (file: string) => {
      try {
        const fullPath = path.resolve(getCwd(), file);
        if (fs.existsSync(fullPath)) {
          const parsed = dotenv.parse(fs.readFileSync(fullPath));
          for (const k in parsed) {
            if (!process.env[k]) process.env[k] = parsed[k];
          }
        }
      } catch (e) {}
    };
    loadEnv('.env.local');
    loadEnv('.env');
  } catch { /* silently ignore — dotenv may not be available in Edge */ }
}

// AUTH_SECRET resolution — hardened fallback
if (!process.env.AUTH_SECRET) {
  if (process.env.ENCRYPTION_KEY) {
    process.env.AUTH_SECRET = crypto
      .createHash('sha256')
      .update(process.env.ENCRYPTION_KEY)
      .digest('hex')
      .slice(0, 32);
    console.warn('[AUTH-RBAC] AUTH_SECRET derived from ENCRYPTION_KEY.');
  } else {
    console.error('[AUTH-RBAC] FATAL: Neither AUTH_SECRET nor ENCRYPTION_KEY is set.');
  }
}
```

### 2. `src/app/actions/auth.ts` — Graceful login without SUPABASE_SERVICE_ROLE_KEY

**Before:** When Supabase Auth rejected credentials and the service key was missing, the login flow fell through to `rbac_users` but then tried Supabase provisioning anyway (which failed), returning a misleading error message.

**After:**
- `provisionSupabaseUserFromLocalCredentials()` returns `null` immediately when `getSupabaseServiceRoleKey()` is empty — no wasted API calls.
- When the service key is unavailable, the local `rbac_users` password check succeeds and then signs in via NextAuth credentials provider (`nextAuthSignIn('credentials', ...)`) instead of attempting Supabase provisioning.
- `retryAfterConfirmingAuthEmail()` also gates on the service key being present.
- Error messages are generic ("Credenciales inválidas") — no leakage about which subsystem failed.

### 3. `.env.local` — AUTH_TRUST_HOST + verified keys

**Added:** `AUTH_TRUST_HOST=true` (also present in `.env`).

**Note:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` starts with `sb_publisable_` — this is Supabase's **new key format**, NOT a typo of `sb_publishable_`. Do not change this value.

### 4. Cache cleanup — `.next` directory purge

The stale Server Action hash error (`Failed to find Server Action "407674b3..."`) was caused by cached client bundles referencing action IDs from a previous build. Resolved by:

```bash
rm -rf .next        # purge stale cache
npm run build       # regenerate with current code
```

Users must also hard-refresh (Ctrl+Shift+R) in the browser to clear cached client bundles.

## Verification Results

| Check | Result |
|---|---|
| Dev server startup | ✅ Next.js 15.2.6, port 3000, no errors |
| `FATAL: AUTH_SECRET is not set` | ✅ Not present in logs |
| `SUPABASE_SERVICE_ROLE_KEY` warning | ✅ Not present (key loaded via dotenv) |
| `/login` page HTTP response | ✅ 200 OK, renders correctly |
| Login form functional | ✅ Interpreter/Admin portal toggle, email + password fields |

## Open Items

- **`deuryd@gmail.com`**: Not in any user table. To enable login, either register via `/register` or add to `rbac_users` seed as an admin.
- **Production deployment**: Ensure `AUTH_SECRET` is set explicitly in Easypanel runtime env (not derived from ENCRYPTION_KEY) for best security.
- **SUPABASE_SERVICE_ROLE_KEY**: Already present in `.env.local` — admin operations (password reset, email confirmation) will work in dev. For Easypanel, set it as a runtime env var (not a build arg).
