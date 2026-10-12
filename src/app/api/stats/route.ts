import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { StatsDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [projects, departments, students, featured, verified, posts, latest] =
      await Promise.all([
        db.project.count({ where: { status: "PUBLISHED" } }),
        db.department.count(),
        db.projectMember.count(),
        db.project.count({ where: { featured: true, status: "PUBLISHED" } }),
        db.project.count({ where: { verified: true } }),
        db.post.count(),
        db.project.findFirst({ orderBy: { year: "desc" }, select: { year: true } }),
      ]);

    const stats: StatsDTO = {
      projects,
      departments,
      students,
      featured,
      verified,
      posts,
      latestYear: latest?.year ?? null,
    };

    return NextResponse.json({ stats });
  } catch (e) {
    console.error("GET /api/stats", e);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
