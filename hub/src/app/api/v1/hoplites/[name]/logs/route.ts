import { NextRequest, NextResponse } from 'next/server';
import { getRegistrySnapshot } from '../../../../../../lib/registry';

export const dynamic = 'force-dynamic';

/**
 * Log Proxy Endpoint
 * GET /api/v1/hoplites/[name]/logs?ns=namespace
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const { searchParams } = new URL(request.url);
  const namespace = searchParams.get('ns') || 'chariot-hoplites';

  try {
    // 1. Locate the agent responsible for this Hoplite
    const registry = await getRegistrySnapshot();
    const agents = Object.values(registry);
    
    const ownerAgent = agents.find(agent => 
      agent.servers?.some(s => s.name === name)
    );

    if (!ownerAgent) {
      return NextResponse.json({ error: `Tactical unit "${name}" not found in active registry.` }, { status: 404 });
    }

    const agentIp = ownerAgent.metadata.agentIp || 'localhost';
    const agentLogUrl = `http://${agentIp}:3001/logs/${name}?ns=${namespace}`;

    console.info(`[LogProxy] Streaming logs from Agent ${ownerAgent.agent_id} at ${agentLogUrl}`);

    // 2. Fetch log stream from Agent
    const agentResponse = await fetch(agentLogUrl);

    if (!agentResponse.ok) {
        return NextResponse.json({ error: 'Tactical comms failure: Agent log stream unreachable.' }, { status: 502 });
    }

    // 3. Proxy the stream back to the browser as a chunked response
    const stream = agentResponse.body;
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('[LogProxy] Failure:', error.message);
    return NextResponse.json({ error: 'Internal Strategic Comms Failure.' }, { status: 500 });
  }
}
