import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { InterpreterSchema } from '@/lib/validators';

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(request: Request) {
  try {
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

    return NextResponse.json(interpreters, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error: any) {
    console.error('Error fetching interpreters:', error);
    return NextResponse.json({ error: error.message || 'Error fetching interpreters' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = InterpreterSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { password, ...interpreterData } = validationResult.data;

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
        // Return 400 with details about the partial success
        const response = NextResponse.json(
          { error: `Interpreter record created (ID: ${newInterpreter.id}), but Auth creation failed: ${authError.message}` },
          { status: 400 }
        );
        response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
        return response;
      }

      if (authUser.user) {
        console.log(`[API_INTERPRETERS_POST] Step 3: Upserting UserProfile for Auth ID: ${authUser.user.id}`);
        try {
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
        } catch (profileError: any) {
          console.error(`[API_INTERPRETERS_POST] ❌ UserProfile DB error: ${profileError.message}`);
          const response = NextResponse.json(
            { error: `Interpreter and Auth user created, but profile linking failed: ${profileError.message}` },
            { status: 500 }
          );
          response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
          return response;
        }
      }
    }

    return NextResponse.json(newInterpreter, { 
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });

  } catch (error: any) {
    console.error('❌ INTERPRETERS_API_POST_ERROR:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      meta: error.meta
    });

    // Handle unique constraint violations
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'external ID or email';
      const response = NextResponse.json(
        { error: `Interpreter with this ${field} already exists.` },
        { status: 409 }
      );
      response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
      return response;
    }
    const response = NextResponse.json({ 
      error: error.message || 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      code: error.code,
    }, { status: 500 });

    // Add CORS headers to error response
    response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  }
}
