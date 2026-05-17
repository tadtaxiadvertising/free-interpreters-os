import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * DEBUG AUTH ENDPOINT — /api/debug-auth
 * ============================================================
 * WARNING: This endpoint reveals user presence and should be
 * removed or protected after debugging.
 *
 * MISSION: Diagnose why Auth.js login is failing with
 * CredentialsSignin (authorize returning null).
 * ============================================================
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  const report: any = {
    timestamp: new Date().toISOString(),
    env: {
      has_database_url: !!process.env.DATABASE_URL,
      has_auth_secret: !!process.env.AUTH_SECRET,
      has_nextauth_url: !!process.env.NEXT_PUBLIC_API_URL || !!process.env.NEXTAUTH_URL,
      node_env: process.env.NODE_ENV,
    },
    database: {
      status: 'unknown',
      error: null,
    },
    user_lookup: {
      found: false,
      role: null,
      has_password: false,
    },
    bcrypt_test: {
      working: false,
      error: null,
    }
  };

  try {
    // 1. Test Bcrypt
    const hash = await bcrypt.hash('test-password', 10);
    report.bcrypt_test.working = await bcrypt.compare('test-password', hash);
  } catch (err: any) {
    report.bcrypt_test.error = err.message;
  }

  try {
    // 2. Test DB Connection
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    report.database.status = 'connected';

    // 3. Test User Lookup if email provided
    if (email) {
      const user = await prisma.rbacUser.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: {
          id: true,
          email: true,
          role: true,
          password: true,
        }
      });

      if (user) {
        report.user_lookup.found = true;
        report.user_lookup.role = user.role;
        report.user_lookup.has_password = !!user.password;
      }
    }
  } catch (err: any) {
    report.database.status = 'failed';
    report.database.error = err.message;
  }

  return NextResponse.json(report);
}
