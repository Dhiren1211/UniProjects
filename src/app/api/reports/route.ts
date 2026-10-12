import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/auth";
import type { ReportDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// ---------- POST { targetType, targetId, reason } — file a report ----------

const reportSchema = z.object({
  targetType: z.enum(["PROJECT", "POST", "USER"]),
  targetId: z.string().min(1),
  reason: z.string().trim().min(3, "Tell us a bit more (min 3 characters)").max(500),
});

export async function POST(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const parsed = reportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { targetType, targetId, reason } = parsed.data;

    if (targetType === "PROJECT") {
      const target = await db.project.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!target) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    } else if (targetType === "POST") {
      const target = await db.post.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!target) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    } else {
      const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.report.create({
      data: { reporterId: viewer.id, targetType, targetId, reason, status: "OPEN" },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("POST /api/reports", e);
    return NextResponse.json({ error: "Failed to file report" }, { status: 500 });
  }
}

// ---------- GET — moderation queue (staff only) ----------

export async function GET(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
    if (!isStaff(viewer.role)) {
      return NextResponse.json({ error: "Staff only" }, { status: 403 });
    }

    const rows = await db.report.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        reporter: { select: { id: true, username: true, displayName: true } },
      },
    });

    // Resolve polymorphic targets in bulk.
    const projectIds = rows.filter((r) => r.targetType === "PROJECT").map((r) => r.targetId);
    const postIds = rows.filter((r) => r.targetType === "POST").map((r) => r.targetId);
    const userIds = rows.filter((r) => r.targetType === "USER").map((r) => r.targetId);

    const [projects, posts, users] = await Promise.all([
      projectIds.length
        ? db.project.findMany({
            where: { id: { in: projectIds } },
            select: { id: true, title: true, slug: true },
          })
        : Promise.resolve([] as { id: string; title: string; slug: string }[]),
      postIds.length
        ? db.post.findMany({ where: { id: { in: postIds } }, select: { id: true, body: true } })
        : Promise.resolve([] as { id: string; body: string }[]),
      userIds.length
        ? db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, displayName: true },
          })
        : Promise.resolve([] as { id: string; displayName: string }[]),
    ]);

    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const postMap = new Map(posts.map((p) => [p.id, p]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    // OPEN first (newest first within each group)
    const open = rows.filter((r) => r.status === "OPEN");
    const rest = rows.filter((r) => r.status !== "OPEN");

    const reports: ReportDTO[] = [...open, ...rest].map((r) => {
      let targetLabel = "Unknown";
      let targetSlug: string | null = null;
      if (r.targetType === "PROJECT") {
        const p = projectMap.get(r.targetId);
        targetLabel = p?.title ?? "Project";
        targetSlug = p?.slug ?? null;
      } else if (r.targetType === "POST") {
        const p = postMap.get(r.targetId);
        targetLabel = p ? p.body.slice(0, 60) : "Post";
      } else {
        const u = userMap.get(r.targetId);
        targetLabel = u?.displayName ?? "User";
      }
      return {
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        reporter: r.reporter,
        targetLabel,
        targetSlug,
      };
    });

    return NextResponse.json({ reports });
  } catch (e) {
    console.error("GET /api/reports", e);
    return NextResponse.json({ error: "Failed to load reports" }, { status: 500 });
  }
}
