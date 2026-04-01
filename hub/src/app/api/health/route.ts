import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Standard Health Check Endpoint
 * GET /api/health
 */
export async function GET() {
  return NextResponse.json(
    { 
      status: 'UP',
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );
}
