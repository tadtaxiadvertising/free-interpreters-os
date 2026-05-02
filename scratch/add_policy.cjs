const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function addPolicy() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to DB');
    
    await client.query(`
      CREATE POLICY "Users can update their own profile" 
      ON user_profiles 
      FOR UPDATE 
      USING (auth.uid() = id) 
      WITH CHECK (auth.uid() = id);
    `);
    
    console.log('Policy "Users can update their own profile" added successfully');

  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('Policy already exists');
    } else {
      console.error('Error:', err);
    }
  } finally {
    await client.end();
  }
}

addPolicy();
