import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const departments = await db.department.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { projects: { where: { status: "PUBLISHED" } } } },
      },
    });

    return NextResponse.json({
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        tagline: d.tagline,
        accent: d.accent,
        projectCount: d._count.projects,
      })),
    });
  } catch (e) {
    console.error("GET /api/departments", e);
    return NextResponse.json({ error: "Failed to load departments" }, { status: 500 });
  }
}
