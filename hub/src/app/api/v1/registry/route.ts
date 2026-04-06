import { NextResponse } from 'next/server';
import { getRegistrySnapshot } from '../../../../lib/registry';

export const dynamic = 'force-dynamic';

/**
 * Registry Snapshot API
 * GET /api/v1/registry
 * 
 * Provides the initial state for the dashboard by returning
 * all currently registered agents and their last known telemetry.
 */
export async function GET() {
  try {
    const registry = await getRegistrySnapshot();
    
    // Transform registry into a more frontend-friendly array if needed,
    // or return the raw Record for the initial hydrate.
    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      clusters: registry
    });
  } catch (error) {
    console.error('[Registry API] Failed to retrieve snapshot:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
