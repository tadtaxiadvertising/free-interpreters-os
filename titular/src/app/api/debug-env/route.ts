import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@') || 'MISSING',
    nodeEnv: process.env.NODE_ENV,
  });
}
