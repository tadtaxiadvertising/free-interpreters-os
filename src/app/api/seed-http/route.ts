import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🌱 HTTP Seeding started...');

    // 1. Interpreters
    const interpreters = [
      {
        externalId: 'INT-HTTP-001',
        name: 'Arismendy Rodriguez (HTTP)',
        status: 'Activo',
        campaign: 'Medical',
        languageA: 'Español',
        languageB: 'Inglés',
        tariffPerMinute: 0.15,
        pais: 'Dominican Republic',
        metodoPago: 'PayPal'
      },
      {
        externalId: 'INT-HTTP-002',
        name: 'Sofia Martinez (HTTP)',
        status: 'Activo',
        campaign: 'Legal',
        languageA: 'Español',
        languageB: 'Inglés',
        tariffPerMinute: 0.18,
        pais: 'Mexico',
        metodoPago: 'Bank Transfer'
      }
    ];

    const { error: intError } = await supabase
      .from('interpreters')
      .upsert(interpreters, { onConflict: 'externalId' });

    if (intError) throw intError;

    // 2. Candidates
    const candidates = [
      {
        name: 'Marcos Peña (HTTP)',
        email: 'marcos-http@example.com',
        status: 'Aplicante',
        pais: 'Dominican Republic',
        englishLevel: 'C1'
      }
    ];

    const { error: candError } = await supabase
      .from('recruitment_candidates')
      .upsert(candidates, { onConflict: 'email' });

    if (candError) throw candError;

    return NextResponse.json({ message: 'HTTP Seed successful' });
  } catch (error: any) {
    console.error('HTTP Seed Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
