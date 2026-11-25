import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isFromOurPages } from "@/lib/same-site";

export const dynamic = "force-dynamic";

// Department list for the site's own pages (project filters, forms).
// Not served to direct visits or other websites.
export async function GET(req: NextRequest) {
  try {
    if (!isFromOurPages(req) && !(await getSessionUser(req))) {
      return NextResponse.json({ error: "Not available" }, { status: 403 });
    }
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
        website: d.website,
        capstoneLabel: d.capstoneLabel,
        accent: d.accent,
        projectCount: d._count.projects,
      })),
    });
  } catch (e) {
    console.error("GET /api/departments", e);
    return NextResponse.json({ error: "Failed to load departments" }, { status: 500 });
  }
}
