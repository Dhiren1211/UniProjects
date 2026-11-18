import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "../_guard";

export const dynamic = "force-dynamic";

// GET /api/admin/activity?q=&area=&before=<iso> - the audit trail (ADMIN).
// area = user | users | project | request | password | announcement |
//        department | settings | report | verification
// Pages of 50, newest first; pass the last row's createdAt as `before` for more.

const PAGE = 50;

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().slice(0, 100);
    const area = (sp.get("area") ?? "").trim().toLowerCase();
    const beforeRaw = sp.get("before");
    const before = beforeRaw ? new Date(beforeRaw) : null;

    const rows = await db.auditLog.findMany({
      where: {
        ...(area && /^[a-z]+$/.test(area) ? { action: { startsWith: `${area}.` } } : {}),
        ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
        ...(q
          ? {
              OR: [
                { actorName: { contains: q, mode: "insensitive" } },
                { targetLabel: { contains: q, mode: "insensitive" } },
                { details: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE + 1,
    });

    return NextResponse.json({
      entries: rows.slice(0, PAGE).map((r) => ({
        id: r.id,
        actorName: r.actorName,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        targetLabel: r.targetLabel,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
      })),
      hasMore: rows.length > PAGE,
    });
  } catch (e) {
    console.error("GET /api/admin/activity", e);
    return NextResponse.json({ error: "Could not load the activity log" }, { status: 500 });
  }
}
