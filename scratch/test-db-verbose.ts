import 'dotenv/config';
import pg from 'pg';

async function test() {
  const connectionString = process.env.DIRECT_URL;
  console.log('Testing DIRECT_URL...');
  
  const client = new pg.Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('Connecting...');
    await client.connect();
    console.log('Connected!');
    const res = await client.query('SELECT NOW()');
    console.log('Success:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

test();
