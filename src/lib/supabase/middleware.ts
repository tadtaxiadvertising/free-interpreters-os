import { createServerClient } from '@supabase/ssr';
import { getToken, type JWT } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

type UpdateSessionResult = {
  response: NextResponse;
  hasValidSession: boolean;
};

const AUTH_SESSION_COOKIE_NAMES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
] as const;

function hasAuthSessionCookie(request: NextRequest) {
  return AUTH_SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
}

async function getValidAuthToken(request: NextRequest): Promise<JWT | null> {
  if (!hasAuthSessionCookie(request)) return null;

  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    console.warn('[MIDDLEWARE] Auth.js session cookie found, but AUTH_SECRET/NEXTAUTH_SECRET is missing; treating session as invalid.');
    return null;
  }

  for (const cookieName of AUTH_SESSION_COOKIE_NAMES) {
    if (!request.cookies.has(cookieName)) continue;
    const token = await getToken({
      req: request,
      secret,
      cookieName,
      secureCookie: cookieName.startsWith('__Secure-'),
    });
    if (token) return token;
  }

  return null;
}

function isInvalidRefreshTokenError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as {
    message?: string;
    code?: string;
    name?: string;
    status?: number;
  };

  return (
    maybeError.code === 'refresh_token_not_found' ||
    maybeError.message?.includes('Invalid Refresh Token') ||
    maybeError.message?.includes('Refresh Token Not Found') ||
    (maybeError.name === 'AuthApiError' && maybeError.status === 400)
  );
}

function collectStaleCookieNames(names: Set<string>, request: NextRequest) {
  names.add('sb-access-token');
  names.add('sb-refresh-token');
  request.cookies.getAll().forEach((cookie) => {
    if (cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')) {
      names.add(cookie.name);
    }
  });
}

function applyCookieDeletions(response: NextResponse, names: Set<string>) {
  names.forEach((name) => response.cookies.delete(name));
}

export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  // Guard: if Supabase env vars are missing, let the request pass through
  // instead of crashing the entire server with a 502.
  // Fallback to non-public variants (common in Easypanel runtime).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    || process.env.SUPABASE_URL?.trim();
  // ANON KEY FIX: real key from Supabase Dashboard
  // Falls back to env var, then hardcoded real key
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
    || process.env.SUPABASE_ANON_KEY?.trim()
    || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6Ymt5Z3BwcGxrbnlucndtdG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTQ4OTYsImV4cCI6MjA5Mjg5MDg5Nn0.1KafepcZR8r-_TAYNEmA0cxO6gviIeL-2ydi4LSsleo";

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '⚠️ MIDDLEWARE: Missing Supabase URL or ANON_KEY (tried NEXT_PUBLIC_* and fallback SUPABASE_*). ' +
      'Auth middleware is disabled. Set these as runtime env vars in Easypanel.'
    );
    return { response: NextResponse.next({ request }), hasValidSession: false };
  }
  let supabaseResponse = NextResponse.next({ request });
  const staleCookieNames = new Set<string>();

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 1. Get the user from Supabase Auth
  let user = null;
  try {
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      if (isInvalidRefreshTokenError(userError)) {
        collectStaleCookieNames(staleCookieNames, request);
      }
    } else {
      user = currentUser;
    }
  } catch (error: any) {
    if (isInvalidRefreshTokenError(error)) {
      collectStaleCookieNames(staleCookieNames, request);
    } else {
      console.warn('🔴 [MIDDLEWARE] Unexpected Supabase auth error:', error);
    }
  }
  const { pathname } = request.nextUrl;
  const validNextAuthToken = await getValidAuthToken(request);
  const hasValidNextAuthSession = !!validNextAuthToken;

  const hasValidSession = !!user || hasValidNextAuthSession;

  // 2. Public paths that don't require Supabase auth
  const publicPaths = [
    '/login',
    '/register',
    '/api/health',
    '/health',
    '/forgot-password',
    '/reset-password',
    '/auth',            // Supabase auth callback
    '/unauthorized',    // Error/Access Denied page
  ];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  const isApiRoute = pathname.startsWith('/api/');

  // 3. Handle non-authenticated users
  // API routes pass through so route handlers can return proper 401 JSON;
  // page routes redirect to /login.
  if (!user && !hasValidNextAuthSession && !isPublic && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirectResponse = NextResponse.redirect(url);
    applyCookieDeletions(redirectResponse, staleCookieNames);
    return {
      response: redirectResponse,
      hasValidSession: false,
    };
  }

  // 4. Fetch profile and role ONCE if authenticated
  let role = 'interpreter';
  if (user) {
    try {
      const { getSupabaseServiceRoleKey } = await import('@/lib/supabase/admin');
      const serviceKey = getSupabaseServiceRoleKey();
      if (serviceKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseAdmin = createClient(
          supabaseUrl,
          serviceKey
        );
        const { data: profile, error } = await supabaseAdmin
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('🔴 [MIDDLEWARE] Error fetching role with service client:', error);
        } else {
          role = profile?.role || 'interpreter';
        }
      } else {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        role = profile?.role || 'interpreter';
      }
    } catch (err) {
      console.error('🔴 [MIDDLEWARE] Exception fetching user role:', err);
    }
  } else if (validNextAuthToken) {
    role = validNextAuthToken.role === 'admin' ? 'admin' : 'interpreter';
  }

  const hasSession = !!user || hasValidNextAuthSession;

  // 5. Handle logged-in users on public pages (like login)
  if (hasSession && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = role === 'admin' ? '/admin' : '/dashboard';
    const redirectResponse = NextResponse.redirect(url);
    applyCookieDeletions(redirectResponse, staleCookieNames);
    return {
      response: redirectResponse,
      hasValidSession: true,
    };
  }

  // 6. Role-based route protection
  if (hasSession && (pathname.startsWith('/admin') || pathname.startsWith('/dashboard'))) {
    if (pathname.startsWith('/admin') && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      const redirectResponse = NextResponse.redirect(url);
      applyCookieDeletions(redirectResponse, staleCookieNames);
      return {
        response: redirectResponse,
        hasValidSession: true,
      };
    }

    if (pathname.startsWith('/dashboard') && role === 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      const redirectResponse = NextResponse.redirect(url);
      applyCookieDeletions(redirectResponse, staleCookieNames);
      return {
        response: redirectResponse,
        hasValidSession: true,
      };
    }
  }

  // 7. Basic role-based root redirection
  if (hasSession && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = role === 'admin' ? '/admin' : '/dashboard';
    const redirectResponse = NextResponse.redirect(url);
    applyCookieDeletions(redirectResponse, staleCookieNames);
    return {
      response: redirectResponse,
      hasValidSession: true,
    };
  }

  // Apply stale cookie deletions to the final supabaseResponse
  applyCookieDeletions(supabaseResponse, staleCookieNames);
  return {
    response: supabaseResponse,
    hasValidSession,
  };
}
