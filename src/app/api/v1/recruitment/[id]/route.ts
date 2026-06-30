import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { RecruitmentCandidatePatchSchema } from '@/lib/api-schemas';
import { apiError, numericIdParamSchema, parseJsonBody } from '@/lib/api-responses';

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = numericIdParamSchema.parse(await params);

    const candidate = await prisma.recruitmentCandidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 });
    }

    return NextResponse.json(candidate, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('Error fetching candidate:', error);
    return apiError({ error, fallback: 'Error fetching candidate' });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = numericIdParamSchema.parse(await params);

    const body = await parseJsonBody(request, RecruitmentCandidatePatchSchema);

    const updatedCandidate = await prisma.recruitmentCandidate.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(updatedCandidate, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('Error updating candidate:', error);
    const isPrismaError = error && typeof error === 'object' && 'code' in error;
    if (isPrismaError && error.code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 });
    }
    return apiError({ error, fallback: 'Error updating candidate' });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = numericIdParamSchema.parse(await params);

    await prisma.recruitmentCandidate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Candidate deleted successfully' }, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    const isPrismaError = error && typeof error === 'object' && 'code' in error;
    if (isPrismaError && error.code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 });
    }
    return apiError({ error, fallback: 'Error deleting candidate' });
  }
}
