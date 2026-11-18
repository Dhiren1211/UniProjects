import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ---------- POST { targetId } - toggle a project like ----------

const toggleSchema = z.object({
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
    const targetId = parsed.data.targetId;
    const targetType = "PROJECT";

    const target = await db.project.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const existing = await db.like.findUnique({
      where: { userId_targetType_targetId: { userId: viewer.id, targetType, targetId } },
    });

    if (existing) {
      await db.like.delete({ where: { id: existing.id } });
      return NextResponse.json({ active: false });
    }

    await db.like.create({ data: { userId: viewer.id, targetType, targetId } });

    return NextResponse.json({ active: true });
  } catch (e) {
    console.error("POST /api/likes", e);
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}
