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

    // 1. Create Interpreter in database
    const newInterpreter = await prisma.interpreter.create({
      data: interpreterData as any,
    });

    // 2. If password provided, create Auth user and UserProfile
    if (password) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabaseAdmin = createAdminClient();

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: interpreterData.emailCorporativo!,
        password: password,
        email_confirm: true,
        user_metadata: { display_name: interpreterData.name }
      });

      if (!authError && authUser.user) {
        await prisma.userProfile.create({
          data: {
            id: authUser.user.id,
            email: interpreterData.emailCorporativo!,
            displayName: interpreterData.name,
            role: 'interpreter',
            interpreterId: newInterpreter.id
          }
        });
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
    console.error('Error creating interpreter:', error);
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: `Interpreter with this ${error.meta?.target?.[0]} already exists.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || 'Error creating interpreter' }, { status: 500 });
  }
}
