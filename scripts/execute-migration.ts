import pg from 'pg';
import fs from 'fs';
import path from 'path';

// Load .env variables
try {
  process.loadEnvFile();
} catch (e) {
  console.warn('⚠️ No .env file found or supported, relying on process environment.');
}

async function main() {
  // Preference for the pooler URL if direct times out
  let connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error('❌ DATABASE_URL or DIRECT_URL is not set in environment.');
  }

  // Clean up pgbouncer if present (DDL shouldn't run through pgbouncer usually)
  connectionString = connectionString.replace('pgbouncer=true', 'pgbouncer=false');

  console.log('🚀 Starting SQL Migration using direct PG client...');

  const client = new pg.Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const sqlPath = path.join(process.cwd(), 'prisma', 'migration_v2_realtime.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split by semicolon, but ignore those inside $$ blocks
  const statements = sql
    .split(/;(?=(?:[^$]*\$\$[^$]*\$\$)*[^$]*$)/g)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`📊 Found ${statements.length} statements to execute.`);

  try {
    await client.connect();
    console.log('✅ Connected to database.');

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const snippet = stmt.substring(0, 50).replace(/\n/g, ' ') + '...';
      try {
        process.stdout.write(`⏳ [${i + 1}/${statements.length}] Executing: ${snippet} `);
        await client.query(stmt);
        process.stdout.write('✅\n');
      } catch (error: any) {
        if (error.message.includes('already exists') || error.message.includes('already a column')) {
            process.stdout.write('⚠️ (Already exists)\n');
        } else {
            process.stdout.write('❌\n');
            console.error(`Error at statement ${i + 1}:`);
            console.error(error.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(error);
  } finally {
    await client.end();
    console.log('🏁 Migration process finished.');
  }
}

main();
