import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  // Guard: if Supabase env vars are missing, let the request pass through
  // instead of crashing the entire server with a 502.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error(
      '⚠️ MIDDLEWARE: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Auth middleware is disabled. Set these as runtime env vars in Easypanel.'
    );
    return NextResponse.next({ request });
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
    if (!userError) {
      user = currentUser;
    }
  } catch {
    // Suppress logs for auth errors
  }


  const { pathname } = request.nextUrl;

  // 2. Public paths that don't require Supabase auth
  const publicPaths = [
    '/login', 
    '/register',
    '/api/health', 
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
    return NextResponse.redirect(url);
  }

  // 4. Fetch profile and role ONCE if authenticated
  let role = 'interpreter';
  if (user) {
    try {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
    return NextResponse.redirect(url);
  }

  // 6. Role-based route protection
  if (user && (pathname.startsWith('/admin') || pathname.startsWith('/dashboard'))) {
    if (pathname.startsWith('/admin') && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith('/dashboard') && role === 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }
  }

  // 7. Basic role-based root redirection
  if (user && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = role === 'admin' ? '/admin' : '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
