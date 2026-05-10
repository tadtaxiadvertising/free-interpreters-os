import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { InterpreterSchema } from '@/lib/validators';
import { withSecurity } from '@/lib/api-security';
import { z } from 'zod';

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export const GET = withSecurity(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const whereClause: any = {};
  if (status) {
    whereClause.status = status;
  }
  if (search) {
    whereClause.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { externalId: { contains: search, mode: 'insensitive' } },
      { emailCorporativo: { contains: search, mode: 'insensitive' } },
    ];
  }

  const interpreters = await prisma.interpreter.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(interpreters);
}, {
  query: z.object({
    status: z.string().optional(),
    search: z.string().optional()
  })
});

export const POST = withSecurity(async (request: NextRequest) => {
  const body = await request.json();
  
  // Validation is already performed by withSecurity wrapper
  const { password, ...interpreterData } = body;

  if (password && !interpreterData.emailCorporativo) {
    return NextResponse.json(
      { error: 'Email corporativo is required when creating an account with a password.' },
      { status: 400 }
    );
  }

  console.log(`[API_INTERPRETERS_POST] Step 1: Creating interpreter record for ${interpreterData.emailCorporativo}`);
  const newInterpreter = await prisma.interpreter.create({
    data: interpreterData as any,
  });
  console.log(`[API_INTERPRETERS_POST] Interpreter created with ID: ${newInterpreter.id}`);

  // 2. If password provided, create Auth user and UserProfile
  if (password) {
    console.log(`[API_INTERPRETERS_POST] Step 2: Creating Auth user for ${interpreterData.emailCorporativo}`);
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabaseAdmin = createAdminClient();

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: interpreterData.emailCorporativo!,
      password: password,
      email_confirm: true,
      user_metadata: { display_name: interpreterData.name }
    });

    if (authError) {
      console.error(`[API_INTERPRETERS_POST] ❌ Auth creation failed: ${authError.message}`);
      return NextResponse.json(
        { error: `Interpreter record created (ID: ${newInterpreter.id}), but Auth creation failed: ${authError.message}` },
        { status: 400 }
      );
    }

    if (authUser.user) {
      console.log(`[API_INTERPRETERS_POST] Step 3: Upserting UserProfile for Auth ID: ${authUser.user.id}`);
      await prisma.userProfile.upsert({
        where: { id: authUser.user.id },
        update: {
          email: interpreterData.emailCorporativo!,
          displayName: interpreterData.name,
          interpreterId: newInterpreter.id
        },
        create: {
          id: authUser.user.id,
          email: interpreterData.emailCorporativo!,
          displayName: interpreterData.name,
          role: 'interpreter',
          interpreterId: newInterpreter.id
        }
      });
      console.log('[API_INTERPRETERS_POST] ✅ UserProfile upserted successfully');
    }
  }

  return NextResponse.json(newInterpreter, { status: 201 });
}, {
  body: InterpreterSchema
});
