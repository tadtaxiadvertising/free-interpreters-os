const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkPolicies() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to DB');
    
    const res = await client.query(`
      SELECT tablename, policyname, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename IN ('user_profiles', 'interpreters');
    `);
    
    console.log('Policies:');
    console.log(JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkPolicies();
