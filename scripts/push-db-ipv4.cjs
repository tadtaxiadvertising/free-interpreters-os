const dns = require('dns');
const cp = require('child_process');

dns.lookup('db.kzbkygppplknynrwmtmf.supabase.co', 4, (err, address) => {
  if (err) throw err;
  console.log('IPv4 resolved:', address);
  
  const dbUrl = `postgresql://postgres:sII7sq36zQ3wuRy@${address}:5432/postgres`;
  const env = { ...process.env, DIRECT_URL: dbUrl, DATABASE_URL: dbUrl };
  
  try {
    cp.execSync('npx prisma db push --accept-data-loss', { env, stdio: 'inherit' });
  } catch (e) {
    console.error('Error running prisma db push:', e);
  }
});
