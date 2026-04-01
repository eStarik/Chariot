import { NextResponse } from 'next/server';
import { saveClusterReport } from '../../../../lib/registry';
import { broadcastUpdate } from '../../../../lib/events';

export const dynamic = 'force-dynamic';

/**
 * Endpoint for Agents to push their status reports.
 * POST /api/v1/report
 */
export async function POST(request: Request) {
  try {
    const agentId = request.headers.get('X-Agent-ID');
    const agentToken = request.headers.get('X-Agent-Token');
    const body = await request.json();

    if (!agentId || !agentToken) {
      return NextResponse.json({ error: 'Missing authentication headers' }, { status: 401 });
    }

    const result = await saveClusterReport(agentId, body, agentToken);

    if (result.success) {
      // Broadcast the update to all connected UI clients (SSE)
      broadcastUpdate(agentId, body);
      
      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      return NextResponse.json({ error: result.error }, { status: result.error === 'Agent not found' ? 404 : 401 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
