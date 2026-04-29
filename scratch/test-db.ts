import 'dotenv/config';
import pg from 'pg';

console.log('Testing connection...');
const connectionString = process.env.DIRECT_URL;
console.log('URL:', connectionString ? 'Present' : 'Missing');

const client = new pg.Client({ connectionString });
try {
  await client.connect();
  console.log('Connected!');
  const res = await client.query('SELECT NOW()');
  console.log('Result:', res.rows[0]);
  await client.end();
} catch (err) {
  console.error('Error:', err);
}
