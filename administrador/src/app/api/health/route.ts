import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = performance.now();
  
  try {
    // ── Pre-check: Environment ─────────────────────────
    if (!process.env.DATABASE_URL) {
      throw new Error('CONFIG_ERROR: DATABASE_URL is missing');
    }

    // ── DB Probe ──────────────────────────────────────
    const dbResult = await Promise.race([
      prisma.$queryRaw<[{ ok: number }]>`SELECT 1 as ok`,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('DB_TIMEOUT')), 3000)
      ),
    ]);

    const latencyMs = Math.round(performance.now() - start);
    const memoryMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

    return NextResponse.json({
      status: 'healthy',
      service: 'administrador',
      checks: {
        database: {
          status: 'connected',
          latencyMs,
          ok: dbResult?.[0]?.ok === 1,
        },
        memory: {
          rssMB: memoryMB,
          warning: memoryMB > 120 ? 'HIGH_MEMORY' : null,
        }
      },
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  } catch (error) {
    console.error('[HEALTH] administrador failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      service: 'administrador',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
