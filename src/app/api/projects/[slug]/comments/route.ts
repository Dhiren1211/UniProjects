import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { notify } from "../../../_utils/notify";
import { commentSelect, toCommentDTO } from "../../../_utils/serialize";
import type { CommentDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// ---------- GET — project discussion, newest first ----------

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const rows = await db.comment.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      select: commentSelect,
    });

    const comments: CommentDTO[] = rows.map(toCommentDTO);
    return NextResponse.json({ comments });
  } catch (e) {
    console.error("GET /api/projects/[slug]/comments", e);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

// ---------- POST { body } — add a comment ----------

const postSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(2000, "Comment is too long"),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const created = await db.comment.create({
      data: { userId: viewer.id, body: parsed.data.body, projectId: project.id },
      select: commentSelect,
    });

    if (project.ownerId && project.ownerId !== viewer.id) {
      notify(
        project.ownerId,
        "COMMENT",
        `${viewer.displayName} commented on ${project.title}`,
        `/project/${project.slug}`
      );
    }

    return NextResponse.json({ comment: toCommentDTO(created) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/projects/[slug]/comments", e);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
