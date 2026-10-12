import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

/**
 * Shared ADMIN gate for /api/admin/** routes.
 * Returns the signed-in viewer on success, or a ready-to-return
 * 401 (guest) / 403 (not an admin) response.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{
  ok: true;
  viewer: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
} | { ok: false; denied: NextResponse }> {
  const viewer = await getSessionUser(req);
  if (!viewer) {
    return {
      ok: false,
      denied: NextResponse.json({ error: "Sign in to continue" }, { status: 401 }),
    };
  }
  if (viewer.role !== "ADMIN") {
    return {
      ok: false,
      denied: NextResponse.json({ error: "Admins only" }, { status: 403 }),
    };
  }
  return { ok: true, viewer };
}
