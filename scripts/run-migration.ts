import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const DIRECT_URL = "postgresql://postgres.kzbkygppplknynrwmtmf:gjkDNBlZuVr9leTw@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

async function main() {
  const client = new Client({ connectionString: DIRECT_URL });
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'prisma/migrations/20260929_add_roleplay_sessions/migration.sql'), 
      'utf-8'
    );
    
    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();