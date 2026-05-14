import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Validamos conexión real a la base de datos
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'green',
      service: 'free-interpreters-os',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'yellow',
      service: 'free-interpreters-os',
      error: 'Database connection unstable',
    }, { status: 503 });
  }
}
