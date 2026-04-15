import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = "force-dynamic";

/**
 * DB Context Diagnosis API
 * GET /api/v1/db-debug
 */
export async function GET() {
  try {
    const context = await (db as any).execute(sql`
      SELECT 
        current_database() as db_name, 
        current_schema() as schema_name, 
        current_user as user_name,
        inet_server_addr() as server_addr,
        version() as postgres_version,
        current_setting('search_path') as search_path
    `);
    
    return NextResponse.json({ 
      success: true, 
      context: context[0],
      env_db_url: process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':****@') // masked
    });
  } catch (error: any) {
    console.error("[DB Debug API] Failure:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      env_db_url: process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':****@') 
    }, { status: 500 });
  }
}
