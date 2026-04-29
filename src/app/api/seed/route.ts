import { NextResponse } from 'next/server';
import pg from 'pg';

export async function GET() {
  // Hardcoded IPv6 test
  const connectionString = 'postgresql://postgres:sII7sq36zQ3wuRy@[2600:1f18:2e13:9d21:5f0b:7fff:cb23:8cf8]:5432/postgres';
  const client = new pg.Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🌱 IPv6 Direct PG Seeding started...');
    await client.connect();
    console.log('Connected!');

    await client.query(`
      INSERT INTO interpreters ("externalId", name, status, campaign, "languageA", "languageB", "tariffPerMinute", pais, "metodoPago", "emailCorporativo")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT ("externalId") DO UPDATE SET name = EXCLUDED.name
    `, ['INT-IPV6-TEST', 'IPv6 Test', 'Activo', 'Test', 'ES', 'EN', 0.1, 'Test', 'Test', 'test@example.com']);

    await client.end();
    return NextResponse.json({ message: 'IPv6 Seed successful' });
  } catch (error: any) {
    console.error('IPv6 Seed Error:', error);
    try { await client.end(); } catch {}
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
