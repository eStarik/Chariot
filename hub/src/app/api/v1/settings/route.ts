import { NextResponse } from 'next/server';
export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const allSettings = await db.select().from(settings);
    return NextResponse.json({ success: true, settings: allSettings });
  } catch (error: any) {
    console.error("[Settings API] GET Failure:", error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { key, value } = body;
    
    await db.update(settings).set({ value }).where(eq(settings.key, key));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Settings API] PATCH Failure:", error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to update setting' }, { status: 500 });
  }
}
