import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type UpdateSessionResult = {
  response: NextResponse;
  hasValidSession: boolean;
};

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

function clearSupabaseCookies(response: NextResponse, request: NextRequest) {
  response.cookies.delete('sb-access-token');
  response.cookies.delete('sb-refresh-token');

  request.cookies.getAll().forEach((cookie) => {
    if (cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')) {
      response.cookies.delete(cookie.name);
    }
  });
}

export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  // Guard: if Supabase env vars are missing, let the request pass through
  // instead of crashing the entire server with a 502.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error(
      '⚠️ MIDDLEWARE: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Auth middleware is disabled. Set these as runtime env vars in Easypanel.'
    );
    return { response: NextResponse.next({ request }), hasValidSession: false };
  }
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
        clearSupabaseCookies(supabaseResponse, request);
      }
    } else {
      user = currentUser;
    }
  } catch (error: any) {
    if (isInvalidRefreshTokenError(error)) {
      clearSupabaseCookies(supabaseResponse, request);
    } else {
      console.warn('🔴 [MIDDLEWARE] Unexpected Supabase auth error:', error);
    }
  }
  const { pathname } = request.nextUrl;
  const hasValidSession = !!user;

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

  // 3. Handle non-authenticated users
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return {
      response: NextResponse.redirect(url),
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
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
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
  }

  // 5. Handle logged-in users on public pages (like login)
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = role === 'admin' ? '/admin' : '/dashboard';
    return {
      response: NextResponse.redirect(url),
      hasValidSession: true,
    };
  }

  // 6. Role-based route protection
  if (user && (pathname.startsWith('/admin') || pathname.startsWith('/dashboard'))) {
    if (pathname.startsWith('/admin') && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return {
        response: NextResponse.redirect(url),
        hasValidSession: true,
      };
    }

    if (pathname.startsWith('/dashboard') && role === 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      return {
        response: NextResponse.redirect(url),
        hasValidSession: true,
      };
    }
  }

  // 7. Basic role-based root redirection
  if (user && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = role === 'admin' ? '/admin' : '/dashboard';
    return {
      response: NextResponse.redirect(url),
      hasValidSession: true,
    };
  }

  return {
    response: supabaseResponse,
    hasValidSession,
  };
}
