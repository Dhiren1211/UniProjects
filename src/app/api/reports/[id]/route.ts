import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ---------- PATCH { status: "RESOLVED" } — resolve a report (staff only) ----------

const patchSchema = z.object({
  status: z.literal("RESOLVED"),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
    if (!isStaff(viewer.role)) {
      return NextResponse.json({ error: "Staff only" }, { status: 403 });
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const report = await db.report.findUnique({ where: { id }, select: { id: true } });
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    await db.report.update({ where: { id: report.id }, data: { status: parsed.data.status } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/reports/[id]", e);
    return NextResponse.json({ error: "Failed to resolve report" }, { status: 500 });
  }
}
