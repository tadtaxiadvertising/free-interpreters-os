import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Validamos conexión a Supabase antes de dar el "Verde"
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ status: 'unhealthy', error: 'DB Connection Failed' }, { status: 503 });
  }
}
