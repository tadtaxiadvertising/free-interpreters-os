const { Client } = require('pg');
require('dotenv').config();

async function updateDb() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    console.log("Adding missing columns to 'interpreters' table...");
    await client.query(`
      ALTER TABLE interpreters 
      ADD COLUMN IF NOT EXISTS shift_start TEXT DEFAULT '09:00',
      ADD COLUMN IF NOT EXISTS shift_end TEXT DEFAULT '17:00';
    `);
    
    console.log("Successfully added 'shift_start' and 'shift_end' columns.");

    // Verify again
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'interpreters';
    `);
    
    console.log("Updated columns in 'interpreters' table:");
    console.log(res.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    console.error("Error updating database:", err);
  } finally {
    await client.end();
  }
}

updateDb();
