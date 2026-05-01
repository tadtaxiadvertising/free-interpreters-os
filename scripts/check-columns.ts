import pg from 'pg';
import 'dotenv/config';

async function check() {
  // Use DIRECT_URL to bypass PgBouncer (required for DDL)
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  console.log('Connecting via DIRECT_URL...');
  
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'interpreters' 
      AND column_name IN ('banco', 'tipo_cuenta', 'cedula_rnc')
      ORDER BY column_name
    `);
    console.log('Existing bank columns:', result.rows);
    
    if (result.rows.length === 0) {
      console.log('\n⚠️  Columns do NOT exist. Running ALTER TABLE...');
      await client.query(`
        ALTER TABLE interpreters
          ADD COLUMN IF NOT EXISTS banco TEXT,
          ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT,
          ADD COLUMN IF NOT EXISTS cedula_rnc TEXT
      `);
      
      await client.query(`
        ALTER TABLE payrate_audit_log
          ADD COLUMN IF NOT EXISTS details TEXT
      `);
      console.log('✅ Columns added successfully!');
    } else {
      console.log('✅ Columns already exist.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
