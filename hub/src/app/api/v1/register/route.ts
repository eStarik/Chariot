import { NextRequest, NextResponse } from 'next/server';
import { validateRegistration } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Managed Agent Registration Endpoint
 * POST /api/v1/register
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Use the shared logic from our auth.ts
    const result = await validateRegistration(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'Missing shared secret' ? 400 : 401 }
      );
    }

    // In a real application, we would persist this in a DB linked to the cluster metadata
    console.log(`[Hub] New Agent Registered: ${result.agent_id} for Cluster: ${body.metadata?.cluster_name}`);

    return NextResponse.json(
      { 
        agent_id: result.agent_id,
        expires_in: 3600 
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
