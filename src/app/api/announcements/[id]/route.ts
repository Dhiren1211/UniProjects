import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/rbac";
import { toAnnouncementDTO } from "../route";

export const dynamic = "force-dynamic";

// ============================================================
// PATCH/DELETE /api/announcements/[id] - admin + moderator.
// ============================================================

const patchSchema = z.object({
  title: z.string().trim().min(4).max(120).optional(),
  body: z.string().trim().min(10).max(4000).optional(),
  pinned: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await getSessionUser(req);
    if (!canAccessAdmin(viewer?.role)) {
      return NextResponse.json({ error: "Staff only" }, { status: viewer ? 403 : 401 });
    }
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid announcement" },
        { status: 400 }
      );
    }
    const existing = await db.announcement.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }
    const updated = await db.announcement.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ announcement: toAnnouncementDTO(updated) });
  } catch (e) {
    console.error("PATCH /api/announcements/[id]", e);
    return NextResponse.json({ error: "Failed to update the announcement" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await getSessionUser(req);
    if (!canAccessAdmin(viewer?.role)) {
      return NextResponse.json({ error: "Staff only" }, { status: viewer ? 403 : 401 });
    }
    const { id } = await ctx.params;
    await db.announcement.delete({ where: { id } }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/announcements/[id]", e);
    return NextResponse.json({ error: "Failed to delete the announcement" }, { status: 500 });
  }
}
