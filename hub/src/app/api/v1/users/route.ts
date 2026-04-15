import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth-config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

/**
 * GET /api/v1/users
 * Returns a list of all commanders in the registry.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role
    }).from(users);

    return NextResponse.json({ success: true, users: allUsers });
  } catch (error: any) {
    console.error("[Users API] GET Failure:", error);
    try {
      const context = await (db as any).execute(sql`SELECT current_database(), current_user, current_setting('search_path')`);
      console.error("[Users API] Failure Context:", context[0]);
    } catch (ctxError) {
      console.error("[Users API] Failed to retrieve failure context:", ctxError);
    }
    return NextResponse.json({ error: error.message || "Failed to retrieve commanders" }, { status: 500 });
  }
}

/**
 * POST /api/v1/users
 * Creates a new commander/view record.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db.insert(users).values({
      id: uuidv4(),
      name,
      email,
      password: hashedPassword,
      role: role || "commander"
    });

    return NextResponse.json({ success: true, message: "Commander commissioned." });
  } catch (error: any) {
    console.error("[Users API] POST Failure:", error);
    return NextResponse.json({ error: error.message || "Commission failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/users
 * Decommissions a commander record by ID.
 */
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Prevent self-deletion
    if (id === (session.user as any).id) {
      return NextResponse.json({ error: "Self-decommissioning is forbidden." }, { status: 403 });
    }

    await db.delete(users).where(eq(users.id, id));
    return NextResponse.json({ success: true, message: "Commander decommissioned." });
  } catch (error: any) {
    console.error("[Users API] DELETE Failure:", error);
    return NextResponse.json({ error: error.message || "Decommission failed" }, { status: 500 });
  }
}
