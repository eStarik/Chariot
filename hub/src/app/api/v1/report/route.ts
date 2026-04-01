import { NextRequest, NextResponse } from 'next/server';
import { saveClusterReport, ClusterReport } from '../../../../lib/registry';
import { broadcastAgentUpdate } from '../../../../lib/events';

export const dynamic = 'force-dynamic';

/**
 * Standard Telemetry Ingestion Endpoint
 * POST /api/v1/report
 */
export async function POST(request: NextRequest) {
  try {
    const agentId = request.headers.get('X-Agent-ID');
    const agentToken = request.headers.get('X-Agent-Token');
    const telemetryPayload = await request.json() as ClusterReport;

    if (!agentId || !agentToken) {
      return NextResponse.json({ error: 'Authentication failed: Missing telemetry headers' }, { status: 401 });
    }

    // Persist the incoming report in the registry
    const persistenceResult = await saveClusterReport(agentId, telemetryPayload, agentToken);

    if (persistenceResult.success) {
      // Broadcast the validated update to all active SSE consumers
      broadcastAgentUpdate(agentId, telemetryPayload);
      
      return NextResponse.json({ status: 'received' }, { status: 200 });
    }

    // Handle authentication or registration mismatches
    const status = persistenceResult.error?.includes('found') ? 404 : 401;
    return NextResponse.json({ error: persistenceResult.error }, { status });
  } catch (error) {
    console.error('[Telemetry] Critical error in ingestion handler:', error);
    return NextResponse.json({ error: 'Internal Telemetry Service Error' }, { status: 500 });
  }
}
