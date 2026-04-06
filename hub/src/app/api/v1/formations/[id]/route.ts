import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params context manually for App router async patterns
    const { id } = await params;
    const body = await request.json();
    
    const updatedFormation = {
      name: body.name,
      version: body.version,
      description: body.description,
      cpu: body.cpu,
      memory: body.memory,
      tickrate: body.tickrate,
      yaml_config: body.yaml_config,
    };
    
    await db.update(formations)
      .set(updatedFormation)
      .where(eq(formations.id, id));
      
    return NextResponse.json({ success: true, formation: updatedFormation });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update formation' }, { status: 500 });
  }
}
