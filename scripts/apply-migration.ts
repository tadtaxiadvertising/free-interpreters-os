import fs from 'fs';
import pg from 'pg';
import path from 'path';
import 'dotenv/config';

async function applyMigration() {
  const sqlPath = path.join(process.cwd(), 'prisma', 'migrations', 'add_bank_details.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('Connecting to database...');
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    console.log('Applying migration...');
    await client.query(sql);
    console.log('✅ Migration applied successfully.');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
