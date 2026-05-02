import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Error: DIRECT_URL or DATABASE_URL not found in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString: connectionString.replace('?pgbouncer=true', ''),
  });

  try {
    console.log('⏳ Connecting to database...');
    await client.connect();
    console.log('✅ Connected.');

    const sqlPath = path.resolve('scripts/migrate-payroll-incentives.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('⏳ Running migration script...');
    await client.query(sql);
    console.log('✅ Migration completed successfully.');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
