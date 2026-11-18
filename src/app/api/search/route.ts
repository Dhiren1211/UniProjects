import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, toSafeUser } from "@/lib/auth";
import { likeCountMap, projectInclude, toListItem } from "../_utils/serialize";
import type { ProjectListItem, SafeUserDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// ---------- GET ?q= - global search across projects and people ----------

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (!q) {
      return NextResponse.json({ projects: [], users: [] });
    }

    const [projectRows, userRows] = await Promise.all([
      db.project.findMany({
        where: {
          status: "PUBLISHED",
          OR: [
            { title: { contains: q } },
            { summary: { contains: q } },
            { tags: { contains: q } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: projectInclude,
      }),
      db.user.findMany({
        where: {
          OR: [
            { username: { contains: q } },
            { displayName: { contains: q } },
            { program: { contains: q } },
            { skills: { contains: q } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          department: {
            select: { id: true, name: true, code: true, tagline: true, website: true, capstoneLabel: true, accent: true },
          },
        },
      }),
    ]);

    const likes = await likeCountMap("PROJECT", projectRows.map((p) => p.id));
    const projects: ProjectListItem[] = projectRows.map((p) =>
      toListItem(p, likes.get(p.id) ?? 0)
    );
    const users: SafeUserDTO[] = userRows.map((u) => toSafeUser(u));

    return NextResponse.json({ projects, users });
  } catch (e) {
    console.error("GET /api/search", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
