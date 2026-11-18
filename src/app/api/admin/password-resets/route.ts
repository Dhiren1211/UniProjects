import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { PasswordResetRow } from "@/lib/types";
import { requireAdmin } from "../_guard";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/password-resets - forgot-password audit log (ADMIN).
// Every public "forgot password" attempt lands here: the address that
// was asked for, whether it matched an account, and when.
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const rows = await db.passwordResetRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Resolve the matched accounts in one query for the admin table.
    const userIds = [...new Set(rows.map((r) => r.userId).filter((v): v is string => Boolean(v)))];
    const users = userIds.length
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, displayName: true, role: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const resets: PasswordResetRow[] = rows.map((r) => ({
      id: r.id,
      email: r.email,
      status: r.status as PasswordResetRow["status"],
      createdAt: r.createdAt.toISOString(),
      user: r.userId ? (userMap.get(r.userId) ?? null) : null,
    }));

    return NextResponse.json({ resets });
  } catch (e) {
    console.error("GET /api/admin/password-resets", e);
    return NextResponse.json({ error: "Failed to load password reset requests" }, { status: 500 });
  }
}
