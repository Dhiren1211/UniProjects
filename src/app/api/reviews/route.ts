import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canReviewProject } from "../_utils/project-access";
import { likeCountMap, projectInclude, toListItem } from "../_utils/serialize";

export const dynamic = "force-dynamic";

// GET /api/reviews - projects waiting for THIS viewer's approval
// (admins see all; professors see their own sections / supervised projects).
export async function GET(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
    if (viewer.role !== "ADMIN" && viewer.role !== "PROFESSOR") {
      return NextResponse.json({ projects: [] });
    }

    const rows = await db.project.findMany({
      where: { status: "PENDING" },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      take: 200,
      include: projectInclude,
    });
    const mine = rows.filter((p) => canReviewProject(viewer, p));
    const likes = await likeCountMap("PROJECT", mine.map((p) => p.id));
    return NextResponse.json({
      projects: mine.map((p) => ({
        ...toListItem(p, likes.get(p.id) ?? 0),
        submittedAt: p.submittedAt?.toISOString() ?? null,
        supervisor: p.supervisor,
      })),
    });
  } catch (e) {
    console.error("GET /api/reviews", e);
    return NextResponse.json({ error: "Could not load the review queue" }, { status: 500 });
  }
}
