import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { RecruitmentCandidateSchema } from '@/lib/validators';

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
        { email: { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search, mode: 'insensitive' } },
      ];
    }

    const candidates = await prisma.recruitmentCandidate.findMany({
      where: whereClause,
      orderBy: { fechaPostulacion: 'desc' },
    });

    return NextResponse.json(candidates, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error: any) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json({ error: error.message || 'Error fetching candidates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = RecruitmentCandidateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const newCandidate = await prisma.recruitmentCandidate.create({
      data: validationResult.data,
    });

    return NextResponse.json(newCandidate, { 
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error: any) {
    console.error('Error creating candidate:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Candidate with this email already exists.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || 'Error creating candidate' }, { status: 500 });
  }
}
