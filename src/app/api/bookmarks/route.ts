import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { likeCountMap, projectInclude, toListItem } from "../_utils/serialize";
import type { ProjectListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// ---------- POST { targetType, targetId } — toggle bookmark ----------

const toggleSchema = z.object({
  targetType: z.enum(["PROJECT", "POST"]),
  targetId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const parsed = toggleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { targetType, targetId } = parsed.data;

    if (targetType === "PROJECT") {
      const target = await db.project.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!target) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    } else {
      const target = await db.post.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!target) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const existing = await db.bookmark.findUnique({
      where: { userId_targetType_targetId: { userId: viewer.id, targetType, targetId } },
    });

    if (existing) {
      await db.bookmark.delete({ where: { id: existing.id } });
      return NextResponse.json({ active: false });
    }

    await db.bookmark.create({ data: { userId: viewer.id, targetType, targetId } });
    return NextResponse.json({ active: true });
  } catch (e) {
    console.error("POST /api/bookmarks", e);
    return NextResponse.json({ error: "Failed to toggle bookmark" }, { status: 500 });
  }
}

// ---------- GET — the viewer's bookmarked published projects ----------

export async function GET(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const marks = await db.bookmark.findMany({
      where: { userId: viewer.id, targetType: "PROJECT" },
      orderBy: { createdAt: "desc" },
      select: { targetId: true },
    });
    const ids = marks.map((m) => m.targetId);

    if (!ids.length) return NextResponse.json({ projects: [] });

    const rows = await db.project.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      include: projectInclude,
    });

    // keep bookmark order (most recently saved first)
    const order = new Map(ids.map((id, i) => [id, i]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    const likes = await likeCountMap("PROJECT", ids);
    const projects: ProjectListItem[] = rows.map((r) => toListItem(r, likes.get(r.id) ?? 0));

    return NextResponse.json({ projects });
  } catch (e) {
    console.error("GET /api/bookmarks", e);
    return NextResponse.json({ error: "Failed to load bookmarks" }, { status: 500 });
  }
}
