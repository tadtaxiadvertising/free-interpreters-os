import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

async function checkAllSchemas() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    console.log('🚀 Searching for user_profiles across ALL schemas...');
    const res = await client.query(`
      SELECT table_schema, column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_profiles'
      ORDER BY table_schema, ordinal_position;
    `);

    res.rows.forEach(row => {
      console.log(`[${row.table_schema}] ${row.column_name} (${row.data_type})`);
    });

  } catch (err) {
    console.error('❌ Check failed:', err);
  } finally {
    await client.end();
  }
}

checkAllSchemas();
