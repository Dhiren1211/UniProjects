import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/rbac";
import type { AnnouncementDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// ============================================================
// GET  /api/announcements - public (pinned first, newest next).
// POST /api/announcements - admin + moderator.
// ============================================================

export function toAnnouncementDTO(a: {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AnnouncementDTO {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    pinned: a.pinned,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

const postSchema = z.object({
  title: z.string().trim().min(4, "Title must be at least 4 characters").max(120),
  body: z.string().trim().min(10, "Body must be at least 10 characters").max(4000),
  pinned: z.boolean().default(false),
});

export async function GET() {
  try {
    const rows = await db.announcement.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    return NextResponse.json({ announcements: rows.map(toAnnouncementDTO) });
  } catch (e) {
    console.error("GET /api/announcements", e);
    return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!canAccessAdmin(viewer?.role)) {
      return NextResponse.json({ error: "Staff only" }, { status: viewer ? 403 : 401 });
    }
    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid announcement" },
        { status: 400 }
      );
    }
    const created = await db.announcement.create({
      data: { ...parsed.data, authorId: viewer!.id },
    });
    await audit(viewer, "announcement.create", { type: "ANNOUNCEMENT", id: created.id, label: created.title });
    return NextResponse.json({ announcement: toAnnouncementDTO(created) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/announcements", e);
    return NextResponse.json({ error: "Failed to create the announcement" }, { status: 500 });
  }
}
