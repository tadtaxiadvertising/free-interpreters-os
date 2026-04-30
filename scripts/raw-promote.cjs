const pg = require('pg');

async function checkAndPromote() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_URL || 'postgresql://postgres:sII7sq36zQ3wuRy@db.kzbkygppplknynrwmtmf.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query("SELECT * FROM public.user_profiles WHERE email = 'interpretersfree@gmail.com'");
    console.log('User profiles found:', res.rows.length);
    
    if (res.rows.length > 0) {
      await pool.query("UPDATE public.user_profiles SET role = 'admin' WHERE email = 'interpretersfree@gmail.com'");
      console.log('User promoted to admin!');
    } else {
      console.log('User not found. Webhook might not have processed yet, or failed.');
      // Create the user manually in the DB just in case
      await pool.query(`
        INSERT INTO public.user_profiles (id, email, display_name, clerk_id, role, created_at, updated_at)
        VALUES (gen_random_uuid(), 'interpretersfree@gmail.com', 'Admin FreeInterpreters', 'user_3D3c7hPdILtG3ll7wrQsMm7AsRS', 'admin', NOW(), NOW())
      `);
      console.log('Inserted user manually as admin.');
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    pool.end();
  }
}

checkAndPromote();
