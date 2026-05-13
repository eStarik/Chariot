import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formations } from '@/lib/db/schema';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const allFormations = await db.select().from(formations);
    return NextResponse.json({ success: true, formations: allFormations });
  } catch (error: any) {
    console.error("[Formations API] GET Error:", error);
    return NextResponse.json({ success: false, error: 'Failed to fetch formations', detail: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newFormation = {
      id: uuidv4(),
      name: body.name,
      version: body.version,
      description: body.description,
      cpu: body.cpu,
      memory: body.memory,
      storage: body.storage || '0Gi',
      tickrate: body.tickrate,
      yaml_config: body.yaml_config,
    };
    
    await db.insert(formations).values(newFormation);
    return NextResponse.json({ success: true, formation: newFormation });
  } catch (error: any) {
    console.error("[Formations API] POST Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create formation',
      message: error.message,
      detail: error.detail 
    }, { status: 500 });
  }
}
