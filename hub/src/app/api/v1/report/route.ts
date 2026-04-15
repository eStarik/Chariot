import { NextRequest, NextResponse } from 'next/server';
import { saveClusterReport, ClusterReport } from '../../../../lib/registry';
import { broadcastAgentUpdate } from '../../../../lib/events';
import { flushCommands } from '../../../../lib/commands';

export const dynamic = 'force-dynamic';

/**
 * Standard Telemetry Ingestion Endpoint
 * POST /api/v1/report
 */
export async function POST(request: NextRequest) {
  console.log('\n\n======================================');
  console.log('[Telemetry] Inbound report request received');
  console.log('HEADERS:', Object.fromEntries(request.headers.entries()));
  console.log('======================================\n\n');
  try {
    const agentId = request.headers.get('X-Agent-ID');
    const agentToken = request.headers.get('X-Agent-Token');
    const telemetryPayload = await request.json() as ClusterReport;

    if (!agentId || !agentToken) {
      return NextResponse.json({ error: 'Authentication failed: Missing telemetry headers' }, { status: 401 });
    }

    // Persist the incoming report in the registry
    console.log(`[Telemetry] Persisting report for ${agentId}...`);
    const persistenceResult = await saveClusterReport(agentId, telemetryPayload, agentToken);
    console.log(`[Telemetry] Persistence result: ${persistenceResult.success}`);

    if (persistenceResult.success) {
      // Broadcast the validated update to all active SSE consumers
      console.log(`[Telemetry] Broadcasting update for ${agentId}...`);
      broadcastAgentUpdate(agentId, telemetryPayload);
      
      // Fetch any pending commands for this specific agent
      console.log(`[Telemetry] Flushing commands for ${agentId}...`);
      const commands = flushCommands(agentId);
      console.log(`[Telemetry] Flushed ${commands.length} commands.`);

      return NextResponse.json({ 
        status: 'received',
        commands 
      }, { status: 200 });
    }

    // Handle authentication or registration mismatches
    const status = persistenceResult.error?.includes('found') ? 404 : 401;
    return NextResponse.json({ error: persistenceResult.error }, { status });
  } catch (error) {
    console.error('[Telemetry] Critical error in ingestion handler:', error);
    return NextResponse.json({ error: 'Internal Telemetry Service Error' }, { status: 500 });
  }
}
