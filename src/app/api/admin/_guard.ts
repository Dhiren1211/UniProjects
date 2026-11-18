import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin, canConfigureSite } from "@/lib/rbac";

type Viewer = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/**
 * Shared gates for /api/admin/** routes.
 *
 * - requireAdmin:  full control (settings, approvals, user writes, emails).
 * - requireStaff:  the limited moderator tier (projects, users read,
 *                  moderation, announcements) - admins pass too.
 */
async function gate(
  req: NextRequest,
  test: (role: string | undefined) => boolean,
  message: string
): Promise<{ ok: true; viewer: Viewer } | { ok: false; denied: NextResponse }> {
  const viewer = await getSessionUser(req);
  if (!viewer) {
    return {
      ok: false,
      denied: NextResponse.json({ error: "Sign in to continue" }, { status: 401 }),
    };
  }
  if (!test(viewer.role)) {
    return {
      ok: false,
      denied: NextResponse.json({ error: message }, { status: 403 }),
    };
  }
  return { ok: true, viewer };
}

export function requireAdmin(req: NextRequest) {
  return gate(req, (role) => canConfigureSite(role), "Administrators only");
}

export function requireStaff(req: NextRequest) {
  return gate(req, (role) => canAccessAdmin(role), "Staff only");
}
