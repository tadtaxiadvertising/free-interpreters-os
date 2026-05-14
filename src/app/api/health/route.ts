import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const healthData: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  };

  try {
    // Basic DB ping to verify connection
    await prisma.$queryRaw`SELECT 1`;
    healthData.database = 'connected';
  } catch (error) {
    healthData.database = 'disconnected';
    healthData.error = error instanceof Error ? error.message : 'Unknown error';
    // We return 200 to indicate the app is alive, even if the DB is failing,
    // so we can at least reach this endpoint to debug.
  }

  return NextResponse.json(healthData);
}
