import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const url = "postgresql://postgres.kzbkygppplknynrwmtmf:gjkDNBlZuVr9leTw@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
console.log("Testing with pure pg");

const pool1 = new pg.Pool({
  connectionString: url,
  connectionTimeoutMillis: 5000,
});

pool1.query("SELECT 1 AS ok")
  .then((res) => console.log("pure pg success:", res.rows))
  .catch((err) => console.error("pure pg error:", err.message))
  .finally(() => pool1.end());

const pool2 = new pg.Pool({
  connectionString: url,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false }
});

pool2.query("SELECT 1 AS ok")
  .then((res) => console.log("pure pg with ssl success:", res.rows))
  .catch((err) => console.error("pure pg with ssl error:", err.message))
  .finally(() => pool2.end());
