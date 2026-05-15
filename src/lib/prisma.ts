import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * PRISMA 7 + SUPABASE CONNECTION POOLER (Master Architect Pattern)
 * ============================================================
 * Optimized for resource-constrained VPS and Supabase Free Tier.
 * Uses @prisma/adapter-pg to avoid connection exhaustion.
 * ============================================================
 */

const globalForPrisma = globalThis as unknown as { 
  prisma: PrismaClient | undefined 
};

// PostgreSQL Connection Pool (max 5 strictly enforced)
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL, // Must use pgbouncer port 6543
  max: 5, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false }
});

const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ 
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;


