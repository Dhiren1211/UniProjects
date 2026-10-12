import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { mapPosts, postInclude } from "../_utils/serialize";

export const dynamic = "force-dynamic";

// ---------- GET — community feed, newest first, limit 50 ----------

export async function GET(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);

    const rows = await db.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: postInclude,
    });

    const posts = await mapPosts(rows, viewer?.id ?? null);
    return NextResponse.json({ posts });
  } catch (e) {
    console.error("GET /api/posts", e);
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }
}

// ---------- POST { body } — create a post ----------

const postSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(2000, "Post is too long"),
});

export async function POST(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const parsed = postSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    await db.post.create({ data: { userId: viewer.id, body: parsed.data.body } });

    const row = await db.post.findFirst({
      where: { userId: viewer.id, body: parsed.data.body },
      orderBy: { createdAt: "desc" },
      include: postInclude,
    });
    if (!row) {
      return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
    }

    const [post] = await mapPosts([row], viewer.id);
    return NextResponse.json({ post }, { status: 201 });
  } catch (e) {
    console.error("POST /api/posts", e);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
