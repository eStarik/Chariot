import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { enqueueCommand } from '@/lib/commands';

/**
 * Deployment Trigger Endpoint
 * POST /api/v1/deploy
 * 
 * Payload: { agentId: string, formationId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { agentId, formationId } = await request.json();

    if (!agentId || !formationId) {
      return NextResponse.json({ error: 'Missing agentId or formationId' }, { status: 400 });
    }

    // 1. Fetch the formation details from the DB
    const result = await db.select().from(formations).where(eq(formations.id, formationId)).limit(1);
    
    if (result.length === 0) {
      return NextResponse.json({ error: 'Formation not found' }, { status: 404 });
    }

    const formation = result[0];

    // 2. Enqueue a deployment command for the target agent
    const commandId = enqueueCommand(agentId, 'DEPLOY_FORMATION', {
      formationId: formation.id,
      name: formation.name,
      yaml: formation.yaml_config
    });

    return NextResponse.json({ 
      success: true, 
      commandId,
      message: `Enqueued deployment of ${formation.name} for agent ${agentId}` 
    });

  } catch (error) {
    console.error('[Deploy] Deployment failed:', error);
    return NextResponse.json({ error: 'Internal Deployment Service Error' }, { status: 500 });
  }
}
