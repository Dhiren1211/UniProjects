import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { notify } from "../../../_utils/notify";
import { commentSelect, toCommentDTO } from "../../../_utils/serialize";
import type { CommentDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// ---------- GET — comments on a post, newest first ----------

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const post = await db.post.findUnique({ where: { id }, select: { id: true } });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const rows = await db.comment.findMany({
      where: { postId: post.id },
      orderBy: { createdAt: "desc" },
      select: commentSelect,
    });

    const comments: CommentDTO[] = rows.map(toCommentDTO);
    return NextResponse.json({ comments });
  } catch (e) {
    console.error("GET /api/posts/[id]/comments", e);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

// ---------- POST { body } — comment on a post ----------

const postSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(2000, "Comment is too long"),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const post = await db.post.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const created = await db.comment.create({
      data: { userId: viewer.id, body: parsed.data.body, postId: post.id },
      select: commentSelect,
    });

    if (post.userId !== viewer.id) {
      notify(post.userId, "COMMENT", `${viewer.displayName} commented on your post`, "/community");
    }

    return NextResponse.json({ comment: toCommentDTO(created) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/posts/[id]/comments", e);
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}
