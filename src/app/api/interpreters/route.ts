import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { InterpreterSchema } from '@/lib/validators';

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

    return NextResponse.json(interpreters);
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

    const newInterpreter = await prisma.interpreter.create({
      data: validationResult.data,
    });

    return NextResponse.json(newInterpreter, { status: 201 });
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
