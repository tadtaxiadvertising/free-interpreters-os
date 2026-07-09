import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Supabase Anon Client with:');
console.log('URL:', url);
console.log('Key:', key);

if (!url || !key) {
  console.error('Missing URL or Key!');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);
      
    if (error) {
      console.error('Error querying with anon client:', error);
    } else {
      console.log('Success querying with anon client!', data);
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

run();
