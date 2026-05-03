const { Client } = require('pg');
require('dotenv').config();

async function checkDb() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    const res = await client.query(`
      SELECT table_schema, table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('payroll_records', 'interpreters');
    `);
    
    console.log("All schemas with these tables:");
    res.rows.forEach(r => console.log(`${r.table_schema}.${r.table_name}: ${r.column_name}`));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

checkDb();
