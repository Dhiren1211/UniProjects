import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { notify } from "../_utils/notify";

export const dynamic = "force-dynamic";

// ---------- POST { targetType, targetId } — toggle follow ----------

const toggleSchema = z.object({
  targetType: z.enum(["USER", "PROJECT"]),
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

    if (targetType === "USER") {
      const target = await db.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
      if (target.id === viewer.id) {
        return NextResponse.json({ error: "You cannot follow yourself" }, { status: 400 });
      }
    } else {
      const target = await db.project.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!target) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const existing = await db.follow.findUnique({
      where: { followerId_targetType_targetId: { followerId: viewer.id, targetType, targetId } },
    });

    if (existing) {
      await db.follow.delete({ where: { id: existing.id } });
      return NextResponse.json({ active: false });
    }

    await db.follow.create({ data: { followerId: viewer.id, targetType, targetId } });

    if (targetType === "USER") {
      notify(
        targetId,
        "FOLLOW",
        `${viewer.displayName} started following you`,
        `/u/${viewer.username}`
      );
    }

    return NextResponse.json({ active: true });
  } catch (e) {
    console.error("POST /api/follow", e);
    return NextResponse.json({ error: "Failed to toggle follow" }, { status: 500 });
  }
}
