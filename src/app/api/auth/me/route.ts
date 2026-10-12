import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, toSafeUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ user: null });
    return NextResponse.json({ user: toSafeUser(user) });
  } catch (e) {
    console.error("GET /api/auth/me", e);
    return NextResponse.json({ user: null });
  }
}
