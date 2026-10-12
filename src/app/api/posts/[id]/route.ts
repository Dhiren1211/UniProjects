import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ---------- DELETE — author or staff only ----------

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const post = await db.post.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    if (post.userId !== viewer.id && !isStaff(viewer.role)) {
      return NextResponse.json(
        { error: "Only the author can delete this post" },
        { status: 403 }
      );
    }

    await db.post.delete({ where: { id: post.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/posts/[id]", e);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
