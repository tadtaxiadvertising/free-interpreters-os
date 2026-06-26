import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const interpreters = await prisma.interpreter.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(interpreters);
  } catch (error) {
    console.error('Error fetching interpreters for select:', error);
    return NextResponse.json([], { status: 500 });
  }
}
