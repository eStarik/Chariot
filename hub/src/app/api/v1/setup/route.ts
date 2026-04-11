import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

export async function GET() {
  const existingUsers = await db.select().from(users);
  return NextResponse.json({ setupRequired: existingUsers.length === 0 });
}

export async function POST(req: Request) {
  try {
    const existingUsers = await db.select().from(users);
    if (existingUsers.length > 0) {
      return NextResponse.json({ error: "System already initialized" }, { status: 403 });
    }

    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await db.insert(users).values({
      id: userId,
      name,
      email,
      password: hashedPassword,
      role: "commander", // First user is always the SuperAdmin
    });

    return NextResponse.json({ success: true, message: "Imperial Commander established." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
