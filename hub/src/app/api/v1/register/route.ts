import { NextRequest, NextResponse } from 'next/server';
import { validateRegistration } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Handshake endpoint for new and reconnecting agents.
 * POST /api/v1/register
 */
export async function POST(req: NextRequest) {
  try {
    const handshakeRequest = await req.json();
    
    // Validate identity via centralized auth logic
    const handshakeResult = await validateRegistration(handshakeRequest);

    if (!handshakeResult.success) {
      const isMissingSecret = handshakeResult.error?.includes('Missing');
      return NextResponse.json(
        { error: handshakeResult.error },
        { status: isMissingSecret ? 400 : 401 }
      );
    }

    const clusterName = handshakeRequest.metadata?.clusterName || 'unknown-cluster';
    console.info(`[Identity] Provisioned identity for agent: ${handshakeResult.agent_id} (Cluster: ${clusterName})`);

    // Return the provisioned identifiers required for subsequent reporting
    return NextResponse.json(
      { 
        success: true,
        agent_id: handshakeResult.agent_id,
        agent_token: handshakeResult.agent_token,
        status: 'registered'
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Identity] Critical error in registration handler:', error);
    return NextResponse.json(
      { error: 'Internal Identity Service Error' },
      { status: 500 }
    );
  }
}
