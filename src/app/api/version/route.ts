import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // BUILD_TIMESTAMP is injected at docker build time (UTC timestamp)
  const buildTimestamp = process.env.BUILD_TIMESTAMP || process.env.GIT_SHA || Date.now().toString();
  return NextResponse.json(
    { buildTimestamp, buildId: process.env.GIT_SHA || null },
    { status: 200 }
  );
}